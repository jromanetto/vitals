import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const hash = bcrypt.hashSync("poussin2K1", 12);
const secret = crypto.randomBytes(48).toString("base64url");

const lines = [
  `AUTH_EMAIL=julien@romanetto.com`,
  `AUTH_HASH='${hash}'`,
  `SESSION_SECRET='${secret}'`,
  `ANTHROPIC_API_KEY=`,
  `NEXT_PUBLIC_BUILD_ID=prod`,
  ``,
];
fs.writeFileSync(".env", lines.join("\n"));
console.log("env written, hash=", hash.slice(0, 10), "secret len=", secret.length);
