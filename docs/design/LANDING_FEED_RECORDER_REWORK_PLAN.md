# eStories: landing page, home feed, recorder and responsive layout

Prepared: 2026-11-27. Status: proposed implementation plan; no application changes or deployment performed by this document.

## 1. Product direction

eStories should help people turn experience and ideas into stories they can understand, revisit and preserve under their own control. Personal memories, oral histories, culture and creative nonfiction all belong here. The human storyteller is the centre of the product; AI is optional assistance.

The design should make that purpose tangible. A visitor should see how a fleeting spoken moment becomes an edited story and, eventually, part of a personal collection. A returning user should arrive somewhere useful: their home feed, with a clear way to create or continue a story.

Proposed product North Star, pending an explicit metric definition: **people who return to create and revisit meaningful stories**. Measure retained storytellers, first successful saves and returns to an archive; use reading and voluntary sharing as supporting signals. Page views, animation engagement, token balances and time spent scrolling are not substitutes for that value. Do not invent a measured baseline or wire new analytics as part of a visual change.

### Standing design constraints

- Preserve the eStories logo, script wordmark, established blue/purple/gold identity, useful copy and product information. Change composition and execution, not the brand.
- Retain both light and dark themes, visible Log in and Sign up actions, Google onboarding and optional wallet access.
- Keep feature and pricing explanations, privacy information, founder context and FAQs. A content inventory must show where each existing section goes before implementation removes anything.
- AI availability notices and onchain verification “coming soon” remain truthful. No fabricated adoption figures, endorsements, activity, scarcity or verification claims.
- Do not activate providers, change billing, migrate the database, alter payment logic or pause eBrain for this work.
- The older Living Archive guide includes palette and wordmark replacement instructions. Those conflict with the owner's later brand-preservation instructions and do not apply to this rework. Borrow its care for stories and craftsmanship, not its proposed rebrand.

## 2. What the current implementation establishes

Code baseline: deployed `9e44cade4372d0f54b7329d459353728fa8fef6d`. The reviewed isolated worktree has an identical Git tree. The user's main checkout is older and contains unrelated changes, including AuthProvider and documentation moves; implementation must preserve them and start from current master in an isolated feature branch.

| Observation | Source / implication |
| --- | --- |
| The homepage has good benefit copy but relies heavily on a large centred heading, icons and repeated cards. | `app/HomePageClient.tsx`: retain its content while replacing the visual composition. |
| Signed-in Home and the brand link still point to `/`. Successful OAuth normally returns there too. | `components/Navigation.tsx`, `app/api/auth/callback/route.ts`: returning users are sent back to marketing. |
| `/social` already offers Latest, Trending and Following using the public story feed. | Reuse its proven components and API boundary, rather than building a second social system. |
| The social sidebar hardcodes three featured writers; the “trending” statistic is also hardcoded. | These must not become prominent claims on the new home feed. Use real eligible data or an honest empty state. |
| The current feed fetches all public stories; some database failures become HTTP200 with an empty list. | Add bounded pagination and distinguish an outage from a genuinely quiet community before making this the default destination. |
| The recorder has a plain Start/Stop button. | The prior glowing circular microphone exists in commit `a2cb94cd51142df65e2879ba67c54fbfc00abfb6`. Recover its visual treatment, not the entire old recorder file. |
| Story cards contain long-text and fixed-action flex rows; tabs keep labels on one line. | Candidate overflow sources requiring fixtures and browser measurement, not established causes of every reported overflow. |

The last release's public-homepage checks passed at selected sizes. That does not establish that signed-in feeds, long content, dialogs or every app route are overflow-free.

Fresh November27 browser measurements after connection approval: public `/` and `/social` each had document scroll width equal to client width, with no detected out-of-bounds main/header/footer elements, at effective viewport widths320,390,853 and1600 CSS pixels. The desktop effective sizes differed from the requested emulation settings; report the measured widths, not fictional768/1440 results. These are limited public-state observations, not a reproduction or fix of the reported app-wide issue. Signed-in and long-content fixtures remain required in checkpoint1.

## 3. Creative direction: a story taking shape

The signature composition is a continuous transformation: **voice → words → perspective → a story worth keeping**. A waveform becomes a line under a sentence, then the spine of a collection. This should be a recognisable eStories device that also connects the landing page with the restored recorder.

### First screen

Use an authored, asymmetric composition. The existing headline and short explanation occupy one side; a substantial, deliberately composed story scene occupies the other. The primary action stays near the text and appears before the demonstration on mobile.

The scene contains three carefully arranged objects:

1. A voice fragment with a small circular microphone and waveform.
2. A readable story sheet with a title, a short passage and editorial marks.
3. A collection cover emerging behind the sheet, suggesting that individual moments can become a larger body of work.

These are actual responsive interface elements, not a flattened screenshot behind invisible buttons. The logo provides the visual vocabulary: book, voice, light and personal expression. Use blue for the voice/action, purple for interpretation and gold for the preserved chapter. Give each a specific role instead of washing every surface in the same gradient.

The scene can have shallow perspective, paper edges and selective lighting, while the surrounding interface retains the current brand surfaces. Perspective is local to the objects; controls and reading text remain flat and legible. No full-page particle field, floating orb background or mandatory WebGL download.

Provide one optional interaction: **explore the same sample as voice, text and a saved chapter**. A small set of explicit buttons changes the scene; keyboard and touch receive the same information. Use authored fictional content, labelled as an illustrative example. Audio must be licensed or owner-created, user-initiated and accompanied by a transcript. No microphone request, inference call, customer story or autoplay audio is needed to understand the demonstration. An example interpretation must not suggest that held AI features are currently enabled.

### The rest of the page

| Section | Creative treatment | Content to preserve |
| --- | --- | --- |
| Why eStories exists | A broad editorial passage with a few meaningful fragments: an everyday observation, a family recollection, a cultural account. Clear hierarchy and varied scale, rather than three identical icon cards. | Voice matters, memories deserve care, individual perspective. |
| Talk / Understand / Own | One connected sequence using the same sample. The visual thread moves from waveform to editable text to a collection. Each step also stands on its own without animation. | Existing three-step explanation and availability/privacy qualifications. |
| What people can make | A composed shelf of three distinct examples: a personal chapter, an oral history and a cultural/creative story. Each has different editorial structure, not just a changed icon. | All six current benefit areas, including collections and community. |
| Privacy and choice | A precise, calm layout showing account storage, optional Local Vault and optional public sharing as separate choices. | Existing caveats about browser storage, backups and public permanence. |
| Community and founder | Real editorial context and opt-in public examples where permission exists. Otherwise use clearly labelled samples and the existing founder context. | Human purpose; no invented social proof. |
| Pricing / FAQs / closing invitation | Keep the useful detail, with stronger spacing, typography and comparison hierarchy. Repeat the primary invitation at a deliberate point. | Current benefits, limits, availability, FAQ answers and destinations. |

### Craft rules

- Retain the wordmark. Refine line lengths, leading, spacing, weights and contrast before introducing another typeface. A display-font experiment belongs in the preview, scoped to marketing; it must not silently replace the brand font throughout the app.
- Give the page a deliberate rhythm: concentrated storytelling scene, quieter reading passage, connected product sequence, detailed comparisons. Avoid repeating the same card template down the whole page.
- Limit decorative gradients to lighting or brand emphasis. Story content, illustrations and typography carry the composition.
- Motion should explain a transition and then settle. Respect reduced-motion preferences, provide a static version, and offer a way to stop any nonessential extended loop.
- Avoid scroll hijacking, mandatory parallax, custom cursors, hover-only disclosure and tiny decorative text.
- Do not generate final assets before the composition works in a responsive prototype. Any approved assets need provenance, dimensions, compressed sizes and fallbacks.

## 4. Signed-in Home and login destinations

Yes: a home feed is a better default destination for an established user than the marketing landing page. It should reconnect them with stories and creation, rather than repeat the acquisition pitch.

### Routing policy

| Situation | Destination |
| --- | --- |
| Visitor opens `/` without a session | Public landing page. |
| Returning onboarded user logs in with no specific task | `/home`. |
| Signed-in user opens `/` or clicks workspace Home / the app logo | `/home`. |
| Person selects a task such as Create before logging in | Resume the validated `/record` intent after authentication and any required profile setup. |
| New account needs profile setup | `/onboarding`, retaining the intended destination. Completion goes to `/home` by default or the explicit task. |
| Signed-in user opens a valid deep link | Stay on that route; do not redirect every authenticated page to Home. |
| Login is cancelled, fails or expires | Show a recoverable error; do not produce a redirect loop or overwrite an editor draft. |

Keep `/social` available as public Discover, including its existing deep links. Add `/welcome` as an explicit way for signed-in people to view the same marketing content; use one shared landing component, not a second maintained page. Give the duplicate marketing path the canonical metadata of `/`. Update marketing-information links so they do not unexpectedly send a signed-in person back to their feed.

### Home feed composition

- Compact greeting and a prominent Create a story action. A Continue draft action appears only when a draft belongs to the current account.
- Main reading column with Latest and Following. Default to Latest while a new user has no follows. Preserve the selected tab in the URL.
- Supporting archive/creation links; no wall of zero counters, placeholder token balances or fake featured writers.
- Honest loading, failure, retry, no-following and no-public-stories states. A quiet community should still offer a useful first action.
- Keep private drafts and archive summaries separate from public feed data. Never insert private entries into a public response or a marketing preview.

### Implementation approach

1. Introduce a small pure destination resolver and test its decision table first. Allowed internal destinations are explicit; reject external URLs, scheme-relative paths, encoded bypasses and unexpected return values.
2. Keep the existing Google PKCE callback, verified identity resolution, wallet sign-in and Firefox same-origin refresh mechanisms. Add navigation coordination around them rather than redesigning AuthProvider.
3. Preserve a short-lived, tab-scoped, allowlisted navigation intent for client-initiated login. Clear it after consumption, logout or terminal authentication failure. Never put credentials or tokens into a return URL. Verify callback allowlist behaviour before changing a provider redirect URL; a query string must not silently break the registered callback.
4. Guard `/home` using actual resolved profile/onboarding state. Wait for authentication resolution; a transient null profile must not bounce between public and signed-in routes. An expired session gets a deliberate signed-out state, not somebody else's cached feed.
5. Extract reusable feed presentation/query logic from `/social` while retaining its existing contract and behaviour. Scope authenticated query keys to the canonical profile ID; reset viewer-dependent follow/like state on account changes.
6. Add opt-in cursor pagination to the existing feed endpoint, with a proposed page size of20 and maximum50. Use stable `(created_at, id)` ordering and validated cursors, based on the real database ID type. Migrate the web consumers together; keep the legacy response shape during transition and document its remaining unbounded path. Bound follow/like batch requests too.
7. Preserve public-only filtering, moderation/block rules, author projections and audio privacy on every page. A backend failure should give a safe retryable failure, not be relabelled an empty community. Update consumers before changing that error contract.

Do not add a recommendation model, background ranking system, new social database or production migration merely to make Home useful.

## 5. Restore the glowing microphone

Bring back the large circular recorder as the focal point of monologue mode. Preserve the existing microphone handlers, recording duration, media cleanup, account isolation and draft recovery added since the old design.

| State | Visual and behaviour |
| --- | --- |
| Idle | Blue/purple circular control, inner highlight and a restrained halo. A short introductory breath settles to a static glow; hover/focus provides a small response. |
| Requesting permission | Clear waiting label; prevent duplicate starts. No recording pulse before capture actually begins. |
| Recording | Visible Stop icon, timer and active halo/rings. State derives from real recording status, not an unrelated timer. |
| Transcribing / saving | Separate progress text and disabled conflicting actions; preserve typed text. |
| Denied / unavailable / failed | Plain-language recovery, type-instead action and retained editor content. |
| Reduced motion | Static halo, visible icon/status and numeric timer; no information lost. |

Use the existing Motion library or lightweight CSS. Animate opacity/transforms over pre-painted glow layers instead of continuously recalculating blur/shadows. No 3D engine or extra audio stream is needed. The decorative rings cannot intercept input or create page overflow. Provide a clear accessible name and at least a44px usable target; the actual microphone will be substantially larger.

In guided interview mode, retain the compact answer-recording control and the current draft-preservation behaviour. Do not replace its question flow with the monologue recorder.

## 6. Fix horizontal overflow at its source

Treat this as an app-wide layout defect, not a homepage-only cosmetic patch.

### Reproduce and record

- Check landing, Home, Discover, archive, record, story reader, books/collections, tracker, profile, pricing, onboarding, dialogs and navigation.
- Exercise signed-out and synthetic signed-in states; populated, empty, loading and error states; both themes.
- Use320,360,390,768,1024 and1440 CSS-pixel widths, plus desktop200% zoom. Include long titles, usernames, tags, links, unbroken text, expanded menus and validation errors.
- Record the route, state, viewport, document/client width and offending element bounds before changing CSS. A hidden or zero-sized automation viewport is an invalid measurement.

### Apply targeted corrections

- Give shrinking flex/grid children appropriate minimum widths; use zero-minimum grid tracks where content would otherwise widen the page.
- Wrap story text, URLs and metadata safely. Keep full text readable in the reader; do not solve every case with truncation.
- Let action rows and filters wrap. For genuinely horizontal tabs or collections, provide an intentional local scroller with keyboard access instead of allowing the document to scroll sideways.
- Constrain media, covers, waveform/SVG scenes and text inputs to their container; reserve intrinsic dimensions.
- Audit viewport-width calculations, nested padding, absolute positions, translated decorations, portals and mobile safe-area insets.
- Clip only decorative artwork within its own frame. Keep content, focus outlines, dropdowns and modal controls usable.
- Do not add global `overflow-x: hidden` to conceal defects. A narrow document is not a pass if useful content has simply been cropped.

Current source leads: StoryCard title/author/action rows and pre-wrapped content; shared non-wrapping tabs; library filters; story/book headers; tracker controls; account/notification menus. These are inspection targets until a browser/fixture demonstrates the specific offender.

## 7. Implementation checkpoints

| Order | Deliverable | Evidence required to move on |
| --- | --- | --- |
| 1 | Baseline and failing responsive fixtures. Fix confirmed shared/page overflow causes. | Before/after measurements; accessible controls still visible. No broad redesign bundled into the bug fix. |
| 2 | Home route, destination resolver and reusable, bounded feed. | Routing, onboarding, deep-link and account-switch tests; real error/empty states; no fabricated sidebar data. |
| 3 | Restore recorder glow using the current handlers. | Idle/recording/busy/denied/reduced-motion checks; media cleanup and typed-answer retention regressions. |
| 4 | Build the landing hero and one representative supporting section in preview. | Desktop/mobile/light/dark compositions reviewed against the current page and the content inventory. Present the actual preview for design review before replacing the whole page. |
| 5 | Complete the approved composition across the remaining landing sections. | All useful content and destinations retained; responsive, accessibility and performance budgets met. |
| 6 | Final regression, exact-artifact audit and controlled production promotion. | Green exact-commit checks, compatible recovery artifact, production SHA and live-flow verification. This plan itself authorizes no deployment. |

The visual review in checkpoint4 is a concrete preview review, not approval of another abstract style description. If the new composition is not demonstrably better, retain the existing section and revise it. This prevents a repeat of replacing a richer page with a thinner design.

### Expected implementation surfaces

- Landing: `app/HomePageClient.tsx`, extracted landing components and scoped styles; `app/welcome/page.tsx` shares the same composition.
- Home: `app/home/page.tsx`, a Home client component, reusable feed components and feed/query helpers.
- Navigation: `components/Navigation.tsx`, `components/AuthButton.tsx`, a small `lib/auth/navigation.ts` utility; minimal auth-modal/onboarding coordination. Callback changes only where required by the tested destination policy.
- Recorder: `app/record/RecordPageClient.tsx`, ideally an isolated recorder-control component.
- Layout: confirmed offending containers in shared components and affected routes; avoid global-token changes to fix local problems.
- Tests: route-resolution unit cases, existing onboarding/callback/recorder suites and compiled browser fixtures. No LLM judge is needed for these requirements.

## 8. Acceptance and release safety

### Behaviour

- Returning Google and wallet users reach Home by default; incomplete profiles complete onboarding; explicit Create intent and deep links survive login.
- Refresh, cancellation, logout, account switching and session expiry cannot create loops, expose stale account data or erase drafts.
- Feed requests are bounded in the new web flow; paging cannot duplicate/skip same-time entries, reveal private/blocked content or change audio access rules.
- Microphone permission, start/stop, unmount, route change and busy states preserve the current lifecycle guarantees. Use synthetic media in automated tests; do not record a real person's microphone without a controlled test.

### Layout and visual quality

- For every covered state, document scroll width is at most client width plus1 CSS pixel; key controls remain fully reachable. Pair the numerical test with screenshots and element bounds to catch concealed clipping.
- Homepage content inventory reconciles every retained benefit, FAQ, pricing detail and brand asset.
- Original logo/colours remain recognisable. The first screen clearly depicts the product's purpose; it is not another text-and-badges hero with a generic card grid underneath.
- Screen-reader order, contrast, focus visibility, keyboard interaction, captions and reduced-motion presentation are checked against the current interface guidelines.

### Performance

Use the deployed page as the comparison baseline. The initial rework should require no decorative Three.js dependency, no added inference and no new tracking request. Reserve art dimensions, keep offscreen sections cheap and stop animations when their scene is not visible. Proposed asset budget: at most250KiB compressed for the initial hero illustration; optional audio loads after interaction. Compare repeated mobile lab runs under the same conditions; do not claim a meaningful speed improvement from one score or a field percentile without enough traffic.

### Verification and rollout

Run focused deterministic tests first, then TypeScript, lint, production build, compiled Chromium/Firefox journeys and the relevant existing regression suites at milestones. Reuse exact-candidate CI where appropriate. Measure layout on the production build, not solely during hot reload.

No database migration is expected for these UI and navigation changes. Any later discovery requiring schema/provider/payment changes must be separately scoped. Keep the prior compatible deployment available and preserve subsequent database/media writes during application recovery. Apply the installed production audit before promotion and verify the delivered commit, browser journeys and observation window afterward.

Planning reference checked2026-11-27: [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Existing local guides remain historical context; this document records the owner's latest brand, navigation, microphone and overflow requirements.


## Implementation checkpoint ? 2026-11-27

Implemented on `feature/story-led-home` from production source `9e44cade4372d0f54b7329d459353728fa8fef6d`, in an isolated worktree so the owner's uncommitted documentation and other edits remain intact.

- The landing page retains all six benefits, the founder's promise, privacy explanations, pricing, FAQs and waitlist. Its new hero uses an interactive voice/page/book composition, with a clearly fictional example and original kitchen-table cover artwork. Logo and brand tokens remain intact. See [asset provenance and final prompt](../../public/landing/README.md).
- `/home` is the default after authentication. `/welcome` provides an explicit way to revisit the marketing page. A ten-minute, tab-scoped, allowlisted intent preserves recording tasks through login and onboarding; it grants no access. The registered OAuth callback and AuthProvider state machine are unchanged.
- Discover and Home opt into 20-story cursor pages (maximum 50), with deterministic timestamp/UUID ordering, server-side title/body search, Following and Trending filters. Viewer-specific query keys prevent follow/like status reuse across accounts. Block-filter failures return a recoverable error; private audio URLs are excluded. Legacy callers retain their existing feed contract.
- Feed story titles are reader links, separate from action buttons. Like actions use the story UUID directly, avoiding numeric-ID/string mismatch. Synthetic browser tests exercise a real like handler without navigating away.
- The recorder has a circular glow, actual permission-waiting and recording states, reduced-motion support, and animation suspension offscreen/background. Existing recording cleanup, visibility selection, draft persistence and save handlers remain in place.
- Responsive fixes address long names, titles, content, tags, action rows, Library/Profile tabs and the story reader. No document-level overflow mask was introduced.

Verification evidence is tied to source snapshots and compiled build IDs under local `istory-verify-*` directories. The first compiled candidate passed 38 Chromium/Firefox journeys after correcting the layout fixture's deliberately invalid-host CSP boundary. Layout fixtures alone bypass CSP while intercepting every request; the public-journey suite keeps CSP enforced. Final artwork and action changes require a fresh compiled check before the final readiness claim.

The installed Sentry SDK's cold import is now a separately bounded setup hook; transport assertions and their time bounds are retained. This addresses a reproducible Windows test setup timeout without weakening privacy checks.

Current limits: this is a web change, not a native mobile release. Cursor mode caps follow/block filter lists at 1,000 and fails closed beyond that limit. A future relational database query/index review is appropriate before substantially larger social graphs; no migration is included here. No claim of measured field-performance improvement is made. The new image is 39 KB and the design adds no decorative WebGL dependency or inference request.

Production promotion remains separate from implementation and visual review, and requires the installed production audit against the exact final artifact. No database, provider, payment, worker or eBrain state is changed by this work.

Search safety references: [PostgREST URL quoting](https://docs.postgrest.org/en/v16/references/api/url_grammar.html) and [filter operators](https://docs.postgrest.org/en/stable/references/api/tables_views.html). Search regex metacharacters are escaped as literal text; the cursor and search groups are combined in one filter while public/block restrictions remain separate.
