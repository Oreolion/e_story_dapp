import { describe, expect, it, vi } from "vitest";
import { captureSourceIdentity } from "./provenance";

describe("evaluation source identity", () => {
  it("labels an isolated fingerprint without fabricating a Git commit", () => {
    const git = vi.fn();
    expect(captureSourceIdentity("a".repeat(64), git)).toMatchObject({ sourceKind: "isolated-snapshot", sourceSha: null, sourceCommitted: false });
    expect(git).not.toHaveBeenCalled();
  });
  it("records dirty Git evidence without treating HEAD as the full source", () => {
    const git = vi.fn().mockReturnValueOnce("b".repeat(40)).mockReturnValueOnce(" M lib/auth.ts");
    expect(captureSourceIdentity(null, git)).toMatchObject({ sourceSha: "b".repeat(40), worktreeDirty: true, sourceCommitted: false });
  });
  it("fails closed when neither Git nor an explicit snapshot is available", () => {
    expect(() => captureSourceIdentity(null, () => { throw new Error("No repository"); })).toThrow("No repository");
  });
  it("recognizes a clean commit while preserving its full identity", () => {
    const git = vi.fn().mockReturnValueOnce("c".repeat(40)).mockReturnValueOnce("");
    expect(captureSourceIdentity(null, git)).toMatchObject({ sourceSha: "c".repeat(40), worktreeDirty: false, sourceCommitted: true });
  });
  it("rejects an abbreviated or malformed Git identity", () => {
    expect(() => captureSourceIdentity(null, () => "short")).toThrow("Invalid source commit");
  });
  it.each(["", "short", "g".repeat(64)])("rejects malformed snapshot identity %s", digest => {
    expect(() => captureSourceIdentity(digest, vi.fn())).toThrow("Invalid snapshot fingerprint");
  });
});
