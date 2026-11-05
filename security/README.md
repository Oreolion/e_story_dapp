# Runtime dependency security adaptations

These temporary adaptations preserve the existing wallet integrations while fixing two reviewed dependency defects. They are part of the installed application, not advisory suppressions. They apply to the web dependency tree. Mobile has its own lockfile and is not released by this change.

Normal `npm ci --legacy-peer-deps` runs `scripts/install-runtime-compat.mjs` through `postinstall`. When deliberately installing with `--ignore-scripts`, run that script explicitly afterward. Next.js configuration checks both adaptations before starting or building; an absent, unknown or modified copy fails closed.

## Decoder

The override installs the official `decode-uri-component` **0.5.1** release, fixing `GHSA-vcc3-ghjq-m6fr` and `GHSA-qr28-fpjm-wq7f`. Its ESM implementation is unchanged. Older CommonJS consumers expect a callable `require()` result and convert literal `+` to spaces. A generated CommonJS entry preserves those two behaviors around the fixed upstream algorithm. Malformed input is decoded once; the unsafe recursive/rescanning behavior is intentionally removed.

`decoder-compat.mjs` pins npm integrity and the original package/source hashes. The adapter changes only the package export map and adds `index.cjs`. Original upstream code, tests, MIT license and provenance are in [upstream/decode-uri-component-0.5.1](upstream/decode-uri-component-0.5.1/). The upstream source is pinned to [58ed85f5](https://github.com/SamVerschueren/decode-uri-component/tree/58ed85f5adc7cfaee5e49e4d52b067f172d0bcb6).

## Zod constrained collection bounds

The [upstream fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd) for [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) rejects oversized collections before parsing their elements. A compatible fixed Zod3 release was unavailable when reviewed on 2026-11-04. Changing the wallet SDKs to incompatible major versions would require a separate integration migration.

The version-preserving backport applies the same upper-bound behavior to the reviewed Zod3 array/Set implementations, bundled older Zod4 array/Map/Set implementations and Next's compiled Zod3. Zod3 has no public Map size constraint. Existing exports, schema APIs and valid-input behavior remain covered by regression tests. In old Zod4, the guard wraps the initialized `_zod.run` entry because its older check runner otherwise executes conditional checks after an aborted parse. It respects leading-check order, allows earlier overwrites, and skips later checks on rejected raw input. It does not add implicit limits to unbounded schemas: callers must still bound request bytes and unconstrained collections.

[zod-size-backport.json](zod-size-backport.json) binds three exact package versions/integrities/export metadata, Next 15.5.28, 13 modified parser files and 24 unchanged parser/wrapper files. Original and patched hashes are recorded. The package versions are not relabeled as upstream fixes. Unknown versions, copies, exports, sources or modified outputs require review before installation/build can continue. Retire this adaptation when compatible upstream packages contain the fix; update the lockfile, inventory and regression evidence together.

## Verification and CI

Run `npm run test:dependency-security` for decoder/Zod functional and integrity checks. Run `npm run audit:runtime` for the release dependency assessment. That command preserves the raw npm JSON, runs the installed-code regression and policy tests itself, and writes the assessment under `output/dependency-security/`. CI uploads those files even when the gate fails.

The raw audit on 2026-11-04 still reports **18 high, 20 moderate, 6 low, 0 critical**. The high entries all trace to the exact Zod advisory above. The gate considers them mitigated only when the exact affected nodes, pinned installed files and functional tests pass. A new or changed high/critical advisory, unknown dependency chain, changed affected-node set, unavailable audit, invalid count, missing patch or failing test blocks the gate. Moderate/low findings remain visible and are not claimed fixed. This dependency assessment alone does not approve a production release.

The regression suite reproduced 20,000 child parses under a maximum before the backport, then verified zero child/later checks on oversized inputs, one bounded error for invalid oversized inputs, async and nested parsing, valid transformations, overwrite ordering, module exports, wallet query strings, bounded decoder execution, idempotent installation and tamper rejection. Official fixed Zod4 is exercised as a behavioral control. No live wallet connection, production user mutation or provider inference is performed by these tests.

## Compiler tooling dependencies

The Nov5 lockfile scopes fixed leaf versions to their development consumers: Hardhat uses `adm-zip` 0.6.1 and `undici` 6.29.1; hardhat-verify uses the same Undici version; Mocha uses `serialize-javascript` 7.1.4; Solc uses `tmp` 0.2.7. These intentionally exceed older parent ranges, so `scripts/tooling-compat.test.mjs` exercises the real compiler ZIP-processing path, both HTTP/proxy clients and verification wrappers, Mocha parallel-worker serialization and Solc's temporary-file API. Contract compilation and these consumer checks must pass against a fresh lockfile installation. Passing against an older local node_modules tree is insufficient.

The lockfile-only raw full audit captured Nov5 14:44:02 UTC reports **0 critical, 18 high, 46 moderate, 26 low**, down from 24 high before these leaf updates. Runtime counts remain **0 critical, 18 high, 20 moderate, 6 low**; the remaining high findings trace to the separately reviewed Zod advisory, not these tooling leaves. Raw report SHA-256: `cf83e1726a9e15a6dcf00cbe751aa87b501d43461de6b87a17218670976dee05`. This lockfile audit is not installed-code or release evidence; the fresh CI runtime guard must still verify the exact backport and compatibility checks.
