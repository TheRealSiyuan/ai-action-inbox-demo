import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
const root = process.cwd();
const ignored = new Set(["node_modules", ".next", ".git", "coverage"]);
const findings = [];
let count = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    const name = relative(root, path);
    if (entry.isSymbolicLink()) { findings.push(`${name}: unexpected symbolic link`); continue; }
    if (entry.isDirectory()) { walk(path); continue; }
    if (/^(?:next-env\.d\.ts|tsconfig\.tsbuildinfo)$/.test(entry.name)) continue;
    count++;
    if (/^\.env(?:$|\.)|\.(?:db|sqlite|sqlite3|pem|key)(?:$|-)/i.test(entry.name) || /(?:^|[/\\])(?:\.action-inbox|\.claude)(?:[/\\]|$)/.test(name)) findings.push(`${name}: private/runtime file`);
    const text = readFileSync(path, "utf8");
    const rules = [
      ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/],
      ["credential pattern", /GOCSPX-[\w-]+|AIza[\w-]{30,}|ya29\.[\w.-]+|1\/\/[\w-]{30,}|(?:sk-(?:ant-)?|gh[pousr]_)[A-Za-z0-9_-]{18,}/],
      ["home path", /\/(?:Users|home)\/[^\s"']+/],
    ];
    for (const [label, pattern] of rules) if (pattern.test(text)) findings.push(`${name}: ${label}`);
    if (name.startsWith("src/")) {
      if (/https?:\/\//.test(text)) findings.push(`${name}: external URL in app source`);
      if (/process\.env|node:(?:fs|sqlite|http|https|net|child_process)/.test(text)) findings.push(`${name}: environment, disk or network capability`);
    }
    for (const email of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
      const domain = email.split("@")[1];
      if (!/(?:^|\.)example\.(?:com|org|net)$|\.example$/.test(domain)) findings.push(`${name}: non-example email address`);
    }
  }
}
walk(root);
if (findings.length) { console.error([...new Set(findings)].join("\n")); process.exitCode = 1; }
else console.log(`Privacy scan passed: ${count} files; no matching credentials, private data paths, non-example addresses, or external-service capabilities in app source. Generated dependencies/build files excluded.`);
