import { execFileSync } from "node:child_process";

export function captureSourceIdentity(
  snapshotSha256: string | null = process.env.EVAL_SOURCE_SNAPSHOT_SHA256 ?? null,
  git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
) {
  if (snapshotSha256 !== null) {
    if (!/^[a-f0-9]{64}$/.test(snapshotSha256)) throw new Error("Invalid snapshot fingerprint");
    return { sourceKind: "isolated-snapshot", sourceSha: null, worktreeDirty: null, snapshotSha256, sourceCommitted: false };
  }
  const sourceSha = git(["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Invalid source commit");
  const worktreeDirty = git(["status", "--porcelain"]).length > 0;
  return { sourceKind: "git", sourceSha, worktreeDirty, snapshotSha256: null, sourceCommitted: !worktreeDirty };
}
