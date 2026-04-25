import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import readline from "node:readline";
import { execFile } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type Variant = { rsid: string; chromosome: string; position: number; genotype: string };

export async function* iterate23andMe(filePath: string): AsyncGenerator<Variant> {
  let stream: NodeJS.ReadableStream;
  if (filePath.endsWith(".zip")) {
    // Extract to tempdir
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dna-"));
    await exec("unzip", ["-o", filePath, "-d", tmp]);
    const files = await fs.readdir(tmp);
    const txt = files.find((f) => f.endsWith(".txt"));
    if (!txt) throw new Error("No .txt in zip");
    stream = createReadStream(path.join(tmp, txt));
  } else {
    stream = createReadStream(filePath);
  }
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const [rsid, chromosome, posStr, genotype] = parts;
    const position = parseInt(posStr, 10);
    if (!Number.isFinite(position)) continue;
    if (genotype === "--" || genotype === "II" || genotype === "DD" || genotype === "ID" || genotype === "DI") continue;
    yield { rsid, chromosome, position, genotype };
  }
}
