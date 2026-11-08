// Publish the extension via tfx. Extra arguments go to tfx, as --share-with <org> for a private test. The PAT is read from .env and passed to a
// directly-spawned node process (no shell), so it does not enter shell
// history or cmd.exe parsing; like any CLI argument it remains visible to
// local process enumeration while tfx runs.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq < 1 || line.trimStart().startsWith("#")) continue;
    let value = line.slice(eq + 1).trim();
    // Strip one layer of surrounding quotes, the common .env convention.
    if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = parseEnv(readFileSync(join(root, ".env"), "utf8"));
const token = env.SPRINTTIMELINE_PUBLISH_PAT || env.SPRINTTIMELINE_DEV_PAT;
if (!token) {
  console.error("No SPRINTTIMELINE_PUBLISH_PAT or SPRINTTIMELINE_DEV_PAT in .env (see .env.example)");
  process.exit(1);
}
if (!env.SPRINTTIMELINE_PUBLISH_PAT) {
  console.warn("WARN: falling back to SPRINTTIMELINE_DEV_PAT, which is broadly scoped. Mint a Marketplace-publish-only PAT as SPRINTTIMELINE_PUBLISH_PAT.");
}

// Resolve the tfx entry point robustly; fall back to the known internal path.
let tfxEntry;
try {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("tfx-cli/package.json", { paths: [root] });
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.tfx;
  tfxEntry = join(dirname(pkgPath), bin);
} catch {
  tfxEntry = join(root, "node_modules", "tfx-cli", "_build", "tfx-cli.js");
}
if (!existsSync(tfxEntry)) {
  console.error(`tfx entry not found at ${tfxEntry}; run npm install`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [tfxEntry, "extension", "publish", "--manifest-globs", "vss-extension.json", "--output-path", "out", "--no-prompt", "--auth-type", "pat", "--token", token, ...process.argv.slice(2)],
  { cwd: root, stdio: ["ignore", "inherit", "inherit"], shell: false }
);
process.exit(result.status ?? 1);
