# Hono security update

Hono is a transitive dependency of `@wagmi/connectors` through Porto's server
module. iStory implements its HTTP routes in Next.js and does not implement a
Hono server. The root override pins Hono to `4.13.16`, which remains within
Porto's declared `^4.10.3` range. The lockfile changes only Hono's version,
registry URL and integrity value; wallet packages and application APIs stay at
their existing versions.

This replaces the vulnerable package rather than adding an audit exception.
The existing decoder and Zod adaptations remain separate and unchanged.

## Security contracts

`scripts/hono-security.test.mjs` resolves Hono from the installed Porto consumer,
loads its ESM exports and dispatches synthetic requests in memory. It checks:

| Contract | Regression covered |
| --- | --- |
| Mounted paths preserve the actual prefix and encoded path | Dynamic tenant and encoded-backslash requests cannot reach a protected child route through an unprotected outer path. |
| Wildcard authorization remains applied | Explicit parameter patterns, prefix routes and encoded line terminators cannot skip guards. |
| CSRF includes hyperlink-auditing content | Cross-site `text/ping` is rejected before the fixture changes state; a same-origin request still succeeds. |
| Form validation sees submitted fields | Extra multipart parameters cannot hide a forbidden field; an allowed form still succeeds. |
| CSS interpolation preserves the HTML boundary | A closing style tag assembled across template/value boundaries cannot create an executable script element. The test checks that the stylesheet was actually rendered. |
| Consumer API compatibility | Porto's actual ESM router still handles grouped child routes, with external fetch forbidden. |

The security cases were exercised against `4.13.14` before the upgrade to prove
the unsafe behavior. A version-string assertion alone would not establish the
fix. These are library regressions and consumer compatibility checks, not proof
that iStory exposed the affected server APIs or that a production wallet flow
has been accepted.

## Verification and maintenance

Run `npm run test:dependency-security` after installing the committed lockfile.
`npm run audit:runtime` also executes this suite, so the existing required
runtime-security CI job runs the behavioral checks on a clean install. The
normal type, application/evaluation, build and compiled-admission jobs remain
required for a release candidate.

Keep the override and lockfile consistent. For a later Hono update, inspect the
vendor's changes, verify this consumer still supports its declared API, and run
the same regressions. Do not infer deployment from a local install or CI pass:
a new source commit still needs its own artifact identity, configuration,
production audit and delivery checks. This dependency update does not activate
any release flag, database fence, payment handler or worker.

Vendor sources checked November 13, 2026:

- [Hono 4.13.16 security release](https://github.com/honojs/hono/releases/tag/v4.13.16)
- [Mounted-path authorization](https://github.com/advisories/GHSA-4m76-xfj5-7975)
- [Wildcard middleware authorization](https://github.com/advisories/GHSA-h7mg-cq63-vhpq)
- [Hyperlink-auditing CSRF](https://github.com/advisories/GHSA-46wx-v44x-9hh2)
- [Multipart validation](https://github.com/advisories/GHSA-4h7h-rv7c-7m2v)
- [CSS template HTML injection](https://github.com/advisories/GHSA-3gg2-335m-rxc6)
