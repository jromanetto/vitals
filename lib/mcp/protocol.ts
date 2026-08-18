/**
 * Minimal, dependency-free MCP server over the Streamable-HTTP transport in
 * STATELESS mode: every JSON-RPC request maps to a single JSON response, no
 * server-initiated notifications, no session state. This is enough for a
 * read-only tool server and works with `mcp-remote` and claude.ai custom
 * connectors. We implement only what a tools-only server needs: initialize,
 * tools/list, tools/call, ping, and swallowing the initialized notification.
 *
 * Spec: https://modelcontextprotocol.io — JSON-RPC 2.0 framing.
 */

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** A JSON Schema object describing a tool's arguments. */
export type JsonSchema = Record<string, unknown>;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Returns plain text (rendered as a single text content block). Throwing is
   * caught and reported as an MCP tool error (isError: true), not a transport
   * error, so the model can recover. */
  handler: (args: Record<string, unknown>) => Promise<string>;
}

export interface McpServerInfo {
  name: string;
  version: string;
  instructions?: string;
}

const rpcError = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

const rpcOk = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });

/**
 * Handle one JSON-RPC message. Returns a response, or `null` for notifications
 * (no id) which must not be answered. Never throws.
 */
export async function handleMcpMessage(
  msg: JsonRpcRequest,
  server: McpServerInfo,
  tools: McpTool[],
): Promise<JsonRpcResponse | null> {
  const id: JsonRpcId = msg && "id" in msg ? (msg.id ?? null) : null;
  const isNotification = !msg || !("id" in msg) || msg.id === undefined;

  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return isNotification ? null : rpcError(id, -32600, "Invalid Request");
  }

  switch (msg.method) {
    case "initialize":
      return rpcOk(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: server.name, version: server.version },
        ...(server.instructions ? { instructions: server.instructions } : {}),
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notifications — no reply

    case "ping":
      return rpcOk(id, {});

    case "tools/list":
      return rpcOk(id, {
        tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });

    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params.name)}`);
      try {
        const text = await tool.handler(params.arguments ?? {});
        return rpcOk(id, { content: [{ type: "text", text }], isError: false });
      } catch (e) {
        // Report as a tool-level error so the model sees it and can adapt,
        // rather than a transport failure.
        return rpcOk(id, {
          content: [{ type: "text", text: `Erreur outil: ${(e as Error).message}` }],
          isError: true,
        });
      }
    }

    default:
      return isNotification ? null : rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

/**
 * Process a parsed JSON-RPC body (single message or batch) into the response
 * body to return. Batches drop notification (null) responses. Returns `null`
 * when there is nothing to send (e.g. a lone notification) — the caller should
 * then reply 202 Accepted with an empty body.
 */
export async function handleMcpBody(
  body: unknown,
  server: McpServerInfo,
  tools: McpTool[],
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    const out: JsonRpcResponse[] = [];
    for (const m of body) {
      const r = await handleMcpMessage(m as JsonRpcRequest, server, tools);
      if (r) out.push(r);
    }
    return out.length ? out : null;
  }
  return handleMcpMessage(body as JsonRpcRequest, server, tools);
}
