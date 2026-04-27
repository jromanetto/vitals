"use client";
import React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DocCitation = { kind: string; ref: string; label?: string };

/**
 * Strip trailing footnotes the model emits as raw JSON lines like:
 *   [1] {"kind":"doc","ref":"262","label":"…"}
 * Returns clean markdown body + parsed citations array.
 */
export function splitContentAndFootnotes(text: string): { body: string; footnotes: DocCitation[] } {
  const footnotes: DocCitation[] = [];
  const lines = text.split("\n");
  // Walk from the end; tolerate code fences, "Sources" headers, separators, blank lines.
  const footnoteRx = /^\[(\d+)\]\s+(\{.*\})\s*$/;
  const skipRx = /^(?:```+\s*\w*|---+|—+|\*\*\s*sources?\s*\*\*\s*:?|sources?\s*:?)$/i;
  let cut = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l === "") { cut = i; continue; }
    if (skipRx.test(l)) { cut = i; continue; }
    const m = l.match(footnoteRx);
    if (!m) break;
    try {
      const obj = JSON.parse(m[2]) as DocCitation;
      footnotes.unshift(obj);
      cut = i;
    } catch { break; }
  }
  return { body: lines.slice(0, cut).join("\n").trimEnd(), footnotes };
}

function citationLink(kind: string, ref: string, label: string): React.ReactNode {
  let href = "#";
  if (kind === "bm") href = `/biomarkers#${ref}`;
  else if (kind === "dna") href = `/dna?rsid=${ref}`;
  else if (kind === "doc") href = `/files?doc=${ref}`;
  return (
    <Link
      href={href}
      className="inline-flex items-center px-1.5 py-0 mx-0.5 rounded text-[0.7rem] font-mono bg-emerald/15 text-emerald hover:bg-emerald/25 transition border border-emerald/30 align-baseline no-underline"
    >
      {label}
    </Link>
  );
}

/**
 * Replace [bm:xxx] / [dna:xxx] / [doc:xxx] tokens in a string with linkified chips.
 * Used inside markdown text node renderers.
 */
function linkifyCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\[(bm|dna|doc):([^\]\s]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<React.Fragment key={`c${key++}`}>{citationLink(m[1], m[2], m[0])}</React.Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (c) => {
    if (typeof c === "string") return <>{linkifyCitations(c)}</>;
    return c;
  });
}

export function ChatMarkdown({ text }: { text: string }) {
  const { body, footnotes } = splitContentAndFootnotes(text);
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 text-foreground">{renderChildren(children)}</h2>,
          h2: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-2 text-emerald">{renderChildren(children)}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{renderChildren(children)}</h4>,
          h4: ({ children }) => <h5 className="text-xs font-semibold mt-2.5 mb-1 uppercase tracking-wide text-muted-foreground">{renderChildren(children)}</h5>,
          p: ({ children }) => <p className="my-2 leading-relaxed">{renderChildren(children)}</p>,
          ul: ({ children }) => <ul className="my-2 ml-4 space-y-1 list-disc marker:text-emerald/60">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 ml-5 space-y-1 list-decimal marker:text-emerald/60">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed pl-1">{renderChildren(children)}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{renderChildren(children)}</strong>,
          em: ({ children }) => <em className="italic text-muted-foreground">{renderChildren(children)}</em>,
          code: ({ children }) => <code className="px-1 py-0.5 rounded bg-secondary/60 text-emerald font-mono text-[0.78rem]">{children}</code>,
          pre: ({ children }) => <pre className="my-2 p-3 rounded-md bg-secondary/40 border border-border overflow-x-auto text-[0.78rem]">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="my-3 pl-3 border-l-2 border-emerald/40 text-muted-foreground italic">{children}</blockquote>,
          hr: () => <hr className="my-4 border-border/60" />,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald hover:underline">{children}</a>,
          table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full text-xs border border-border rounded-md">{children}</table></div>,
          th: ({ children }) => <th className="px-2 py-1.5 text-left font-medium bg-secondary/50 border-b border-border">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5 border-b border-border/40">{renderChildren(children)}</td>,
        }}
      >
        {body}
      </ReactMarkdown>
      {footnotes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground/70 mb-1.5">Sources</div>
          <ol className="space-y-1 text-xs text-muted-foreground list-none pl-0">
            {footnotes.map((f, i) => {
              const filename = f.label?.split("/").slice(-1)[0] ?? f.ref;
              const href = f.kind === "doc" ? `/files?doc=${f.ref}` : "#";
              return (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="font-mono text-emerald/70 shrink-0">[{i + 1}]</span>
                  <Link href={href} className="hover:text-emerald transition truncate" title={f.label}>
                    {filename}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
