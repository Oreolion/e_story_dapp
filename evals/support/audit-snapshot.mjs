import { cp, mkdir, mkdtemp, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

// Explicit file allowlist: never copy environment files, keys, credentials, or .git.
const root = resolve(import.meta.dirname, "../..");
const snapshot = await mkdtemp(join(tmpdir(), "istory-audit-"));
const folders = ["app", "components", "lib", "contexts", "hooks", "public", "styles", "types", "__tests__", "e2e", "evals", "scripts", "contracts"];
const blocked = /(^|[\\/])(node_modules|\.env[^\\/]*|[^\\/]*(?:credentials|secrets)[^\\/]*)([\\/]|$)|\.(?:pem|key|secret)$/i;
for (const folder of folders) await cp(join(root, folder), join(snapshot, folder), { recursive: true, filter: source => !blocked.test(source.slice(root.length + 1)) });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && (/^(package(?:-lock)?\.json|tsconfig\.json|next-env\.d\.ts|middleware\.ts|instrumentation(?:-client)?\.ts)$/.test(entry.name) || /^(?:next|postcss|eslint|sentry\.(?:server|edge))\.config\.m?[jt]s$/.test(entry.name))) await cp(join(root, entry.name), join(snapshot, entry.name));
}
await symlink(join(root, "node_modules"), join(snapshot, "node_modules"), "junction");
await mkdir(join(root, "output/evaluations"), { recursive: true });
await writeFile(join(root, "output/evaluations/audit-snapshot.json"), JSON.stringify({ snapshot, createdAt: new Date().toISOString(), secretsCopied: false }, null, 2));

const safeEnvironment = {};
for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "COMSPEC", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) if (process.env[name]) safeEnvironment[name] = process.env[name];
Object.assign(safeEnvironment, {
  NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-placeholder",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-placeholder", WALLET_JWT_SECRET: "synthetic-audit-placeholder-not-a-live-key", NEXT_PUBLIC_PROJECT_ID: "synthetic-placeholder",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3001", LANGSMITH_TRACING: "false", LANGCHAIN_TRACING_V2: "false", NODE_OPTIONS: "--max-old-space-size=4096",
});
const mode = process.argv[2] ?? "build";
if (!["build", "serve"].includes(mode)) throw new Error("Expected build or serve");
console.log(`Isolated ${mode} snapshot: ${snapshot}`);
const args = mode === "build" ? ["build"] : ["dev", "--hostname", "127.0.0.1", "--port", "3001"];
const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), ...args], { cwd: snapshot, env: safeEnvironment, stdio: "inherit", windowsHide: true });
const deadline = mode === "build" ? setTimeout(() => { console.error("Isolated build exceeded its ten-minute verification deadline"); child.kill(); }, 10 * 60 * 1000) : undefined;
child.on("exit", code => { if (deadline) clearTimeout(deadline); process.exitCode = code ?? 1; });
child.on("error", () => { if (deadline) clearTimeout(deadline); console.error("Isolated audit process could not start"); process.exitCode = 1; });
process.on("SIGINT", () => child.kill());
