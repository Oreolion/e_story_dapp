# iStory DApp — Unified Agent Configuration

This file governs ALL AI agents working on this project: **Kimi Code CLI**, **Claude Code**, **Codex**, **Cursor**, **OpenCode**, **Aider**, **Cline**, **Windsurf**, and **Copilot**.

When multiple `AGENTS.md` files apply, deeper directories take precedence over parent directories. User instructions in conversation take highest precedence.

---

## User Preferences

- **Model**: Opus-level reasoning / high effort (Kimi-k2.6, Claude Opus, GPT-5.4)
- **Stack**: Next.js, React, TypeScript, Tailwind, shadcn/ui, Supabase, Convex, Firebase, Clerk, Web3
- **Verify before done**: run `tsc --noEmit` + `npm run build` only after milestones, not every simple task
- **Checkpoint**: save progress to memory files at milestones
- **Security**: pause to flag concerns before proceeding
- **No over-engineering**: only implement what's requested
- **Mobile**: Expo React Native app in `/mobile` directory

---

## Project Structure

```
app/              — Next.js App Router (web frontend)
mobile/           — Expo React Native app
components/       — Shared React components
contracts/        — Solidity smart contracts (Hardhat)
lib/              — Utilities, auth, contracts, crypto
scripts/          — Deployment & verification scripts
supabase/         — Database migrations
__tests__/        — Unit & integration tests
e2e/              — Playwright E2E tests
public/           — Static assets
docs/             — Project documentation
```

---

## Available Skills

### Project-Scoped Skills (`.claude/skills/`)
These are checked into the repo and available to all agents:

| Skill | Purpose |
|-------|---------|
| `audit-auth` | Auth security audits |
| `checkpoint` | Save progress at milestones |
| `db-fix` | Database migration/fix utilities |
| `implement` | Feature implementation workflow |
| `migrate-test-loop` | Migration testing loop |
| `parallel-auth` | Parallel auth patterns |
| `resume` | Session resumption |
| `session-restore` | Session state recovery |
| `verify` | Verification workflows |

### Global Skills
See `~/.claude/rules/skill-graph.md` for the full catalog grouped by cluster.

Key clusters for this project:
- **React & Next.js**: `vercel-react-best-practices`, `frontend-design`, `next-best-practices`, `nextjs-performance`
- **3D & Animation**: `threejs-*` skills (this project uses Three.js in `components/three/`)
- **Security**: `api-security-best-practices`, `security-auditor`, `security-review`, `solidity-security`, `pre-deploy-security-audit`
- **Auth & Payments**: `better-auth-best-practices`, `nextjs-supabase-auth`, `stripe-best-practices`, `stripe-integration`
- **Mobile**: `react-native-architecture`, `react-native-best-practices`, `expo-architect`, `expo-mobile-app-rule`
- **Marketing & Growth**: `copywriting`, `content-strategy`, `seo-audit`, `schema-markup`, `social-content`
- **DevOps**: Cloudflare MCP for Workers/KV/R2/D1/DNS

---

## MCP Servers

### Global (all projects)
| Server | URL | Capabilities |
|--------|-----|-------------|
| **Figma** | `mcp.figma.com` | Import designs, inspect components, extract design tokens |
| **Canva** | `mcp.canva.com` | Create/edit visual assets, social media graphics |
| **Cloudflare** | `bindings.mcp.cloudflare.com` | Workers, KV, R2, D1, DNS, edge functions |
| **n8n** | `https://n8n.remyautomates.com/mcp-server/http` | Workflow automation |

### All 35+ MCP Servers (Installed Across All Tools)

**Full reference**: `MCP_SERVERS.md` in project root

| Category | Servers | Status |
|----------|---------|--------|
| **Search** | Tavily, Exa, Brave Search, Perplexity | ✅ Configured |
| **Scraping** | Firecrawl, Apify, Bright Data, Crawl4AI | ✅ Configured |
| **Browser** | Playwright, Browserbase | ✅ Configured |
| **Dev Tools** | GitHub, Linear, Vercel, Atlassian (Jira) | ✅ Configured |
| **Databases** | Supabase, PostgreSQL, MongoDB, Neo4j | ✅ Configured |
| **Vector/Memory** | Pinecone, Qdrant, Chroma, Memory | ✅ Configured |
| **Productivity** | Notion, Slack, Todoist, Zapier | ✅ Configured |
| **Business** | Stripe, HubSpot | ✅ Configured |
| **Design** | Figma, Bannerbear | ✅ Configured |
| **Infrastructure** | Cloudflare, Docker, Grafana | ✅ Configured |

### Existing / Special
| Server | Status | URL/Command | Config Location |
|--------|--------|-------------|-----------------|
| **Sentry** | ✅ Live | `npx @sentry/mcp-server@latest` | `~/.kimi/mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json` |
| **n8n** | ⏸️ Offline (expected) | `https://n8n.remyautomates.com/mcp-server/http` | `~/.kimi/mcp.json`, `~/.cursor/mcp.json` |
| **X (Twitter)** | ⏸️ Needs credentials | `http://127.0.0.1:8000/mcp` | `~/.kimi/mcp.json` — local server in `~/tools/xmcp` |

**n8n note**: Self-hosted via Cloudflare Tunnel. Returns HTTP 530 when Docker container is stopped — this is expected. Config remains in `~/.kimi/mcp.json` so Kimi connects automatically when the container starts.

---

## Permissions & Security Guardrails

### ✅ Allowed Operations
**Package Management & Build**:
- `npm run *`, `npm install *`, `npm audit *`
- `npx tsc *`, `npx tsc --noEmit`
- `npx vitest *`, `npx vitest run *`
- `npx playwright test *`
- `npx hardhat compile *`, `npx hardhat run *`
- `npx expo *`, `npx expo install *`, `npx expo export *`
- `npx shadcn@latest add *`
- `npx next *`, `npx prisma *`, `npx drizzle-kit *`
- `npx supabase *`
- `bun *`, `pnpm *`, `yarn *`

**Git**:
- `git status`, `git diff`, `git log`, `git add`, `git commit`, `git branch`, `git checkout`, `git stash`, `git fetch`, `git merge`, `git rebase`, `git remote`
- `git show:*`
- `gh pr *`, `gh issue *`, `gh run *`, `gh api *`

**CRE (Chainlink Functions)**:
- `cre workflow simulate *`, `cre workflow deploy *`, `cre --help *`, `cre workflow --help *`

**Filesystem**:
- `ls *`, `mkdir *`, `cp *`, `mv *`, `which *`, `node *`
- `cat:*` (except credentials)
- `find *` (with appropriate exclusions)

**Web**:
- `WebSearch`
- `WebFetch(domain:docs.chain.link)`
- `WebFetch(domain:raw.githubusercontent.com)`
- `WebFetch(domain:nextjs.org)`, `WebFetch(domain:react.dev)`
- `WebFetch(domain:docs.soliditylang.org)`
- `WebFetch(domain:viem.sh)`, `WebFetch(domain:wagmi.sh)`
- `WebFetch(domain:docs.expo.dev)`
- `WebFetch(domain:supabase.com)`
- `WebFetch(domain:tailwindcss.com)`, `WebFetch(domain:ui.shadcn.com)`
- `WebFetch(domain:developers.cloudflare.com)`
- `WebFetch(domain:github.com)`, `WebFetch(domain:blog.chain.link)`
- `WebFetch(domain:docs.blockradar.co)`, `WebFetch(domain:www.blockradar.co)`

**MCP**:
- `mcp__playwright`, `mcp__playwright__browser_navigate`, `mcp__playwright__browser_click`, `mcp__playwright__browser_wait_for`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_console_messages`
- `mcp__supabase`

### ❌ Blocked Operations (NEVER do these)
- **Read secrets**: `.env`, `.env.local`, `.env.production`, `.env.development`, `**/.env*`, `**/credentials*`, `**/secrets*`
- **Destructive filesystem**: `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, `rm -rf ..`
- **Dangerous git**: `git push --force *` to main/master, `git reset --hard *`, `git clean -f *`
- **Database destruction**: `DROP TABLE`, `DROP DATABASE`
- **Supply chain risk**: `curl * | bash` (piping curl to shell)
- **Credential exposure**: `cat|head|tail|less|more` on `*.env`, `*.pem`, `*.key`, `*.secret` files

---

## Hooks

### Pre-Read / Pre-Grep (Project)
Before reading files: `node ./hooks/read_hook.js` (5s timeout)
- Blocks `.env` reads (allows `.env.example`)
- Logs tool arguments for debugging

### Pre-Bash (Global)
Before bash commands: `bash ~/.claude/hooks/bash-firewall.sh` (5s timeout)
- Blocks destructive `rm -rf` targeting root/home/parent
- Blocks force push to main/master
- Blocks DROP TABLE/DATABASE
- Blocks `curl | bash` piping
- Blocks credential file reads

### Post-Write / Post-Edit (Project)
After file edits: `node ./hooks/tsc.js` (30s timeout)
- Runs `npx tsc --noEmit` for TS/JS files only
- Reports type errors but does **NOT** block the edit
- Skips non-JS/TS files automatically

---

## Security Deploy Gate

Before every production deploy, run `pre-deploy-security-audit` skill — 10-check automated audit covering rate limits, RLS, auth guards, input validation, SSRF/email abuse, secret leaks, CORS, CSP headers, dependency vulns, and redirect safety.

For new features involving auth, file uploads, secrets, or new API routes, also cross-check against `~/.claude/rules/security-audit-checklist.md`.

### Quick Security Audit Script
```bash
npm audit --audit-level=high
npx tsc --noEmit
grep -r '"fallback\|"secret\|"password\|"test123' --include="*.ts" --include="*.tsx" lib/ app/api/
git log --all --full-history -- .env .env.local
grep -r "SELECT.*WHERE.*\+" --include="*.ts" app/  # Raw SQL concat
grep -r "Access-Control-Allow-Origin.*\*" --include="*.ts" .  # CORS wildcard
```

---

## Verification Protocol

1. **After milestones only** (not every simple task):
   - Run `npx tsc --noEmit`
   - Run `npm run build`
2. **Before deploys**:
   - Run `npm audit --audit-level=high`
   - Run pre-deploy-security-audit skill
   - Check no `.env` files in git history
3. **After subagent delegation**:
   - Run `npx tsc --noEmit` if subagent touched TS files

---

## Cross-Agent Sync Protocol

If `.ai-sync/` directory exists in this project:

### On Session Start (MANDATORY)
1. Read `.ai-sync/HANDOFF.md` — understand current state and follow "Next Steps"
2. Read `.ai-sync/PROGRESS.md` — know what's done vs pending
3. Read `.ai-sync/PLAN.md` — follow the plan, do not deviate
4. **Stale handoff detection**: If HANDOFF.md timestamp is old but `git log` shows recent changes, reconcile by running `git diff --name-only` + `git log --oneline -10`, cross-reference against PROGRESS.md, and update both files before continuing.

### During Work
- Check off completed items in PROGRESS.md as you finish them
- Document blockers in HANDOFF.md immediately
- Match existing code patterns — read neighboring files first

### On Session Stop (MANDATORY)
Before ending for ANY reason, update `.ai-sync/HANDOFF.md` with:
- `last_agent: <your-agent-name>` (kimi-code, claude-code, codex, cursor, etc.)
- `timestamp:` current ISO-8601
- `status:` paused | blocked | completed
- `stop_reason:` rate-limit | context-limit | completed | user-switch
- Sections: What Was Completed, Next Steps (specific + actionable), Files Modified/Created, Blockers, Build Status

Also update PROGRESS.md and create a session log in `sessions/`.

### Five Rules for All Agents
1. **Follow the plan** — No unplanned features, refactors, or improvements
2. **Don't repeat work** — Check PROGRESS.md first
3. **Be specific** — "Create `convex/ai.ts` with generateCreativeBrief action" not "Continue AI work"
4. **Verify before stopping** — Run `npx tsc --noEmit` + `npm run build`
5. **Document decisions** — The next agent has zero context

See `~/.claude/rules/ai-sync-protocol.md` for full spec.

---

## Composition Patterns

See `~/.claude/rules/composition-patterns.md` for 11 multi-agent workflow patterns.

### Common Workflows for This Project

**Design-to-Code**:
```
Figma MCP (extract design) -> code-explorer (understand patterns) -> frontend-design (implement) -> web-design-guidelines (review) -> code-reviewer (quality check)
```

**Security Audit**:
```
pre-deploy-security-audit (10-check) -> security-review (deep dive) -> security-auditor (scan) -> api-security-best-practices (fix) -> solidity-security (contracts)
```

**Full Feature Lifecycle**:
```
/feature-dev (plan) -> code-architect (design) -> implement -> code-reviewer (review) -> /commit-push-pr (ship) -> /review-pr (final review)
```

**Mobile App Build**:
```
expo-architect (scaffold) -> react-native-architecture (structure) -> react-native-best-practices (optimize) -> code-reviewer (review)
```

---

## Delegation Strategy

### For Kimi Code CLI
Use `Agent` tool with appropriate `subagent_type`:
- **Always delegate**: Grep/search, simple file edits, boilerplate generation, mechanical refactors, lint fixes, dependency updates, git operations, simple bug fixes, config changes, copy updates
- **Never delegate**: Architecture decisions, security-sensitive work, complex debugging, multi-step implementations (5+ files), plan creation/review, smart contract work, context-heavy tasks

**Quick rule**: Could a competent junior dev do this with just the file path and a one-line instruction?
- **Yes** → Delegate to `Agent({ subagent_type: "explore" | "coder" })`
- **No** → Handle on main agent

### For Claude Code / Codex
See `~/.claude/rules/codex-delegation.md` for full matrix.

---

## Kimi-Specific Configuration

- **Default model**: `kimi-code/kimi-for-coding` (Kimi-k2.6)
- **Thinking**: Always enabled unless user explicitly disables
- **Subagent model**: `kimi-k2.6`
- **Max steps per turn**: 500
- **Reserved context**: 50000 tokens
- **Compaction trigger**: 0.85 ratio
- **Background tasks**: max 4 concurrent
- **MCP tool timeout**: 60s

Read `~/.kimi/KIMI.md` for global Kimi instructions.

---

## Cursor Configuration

- **MCP**: Sentry at `https://mcp.sentry.dev/mcp` (configured in `.cursor/mcp.json`)
- Rules: `.cursorrules` (project-level)

## Codex Configuration

- **Model**: gpt-5.4
- **Instructions**: `~/.codex/instructions.md`
- **Plugins**: sentry, cloudflare, github, canva (all enabled)

---

## Agent Command Graph

See `~/.claude/rules/agent-command-graph.md` for full agent/plugin tables and slash commands.

### Key Slash Commands for This Project
- `/resume` — Resume from checkpoint
- `/implement` — Run implement skill workflow
- `/checkpoint` — Save progress checkpoint
- `/verify` — Run verification workflows
- `/migrate-test-loop` — Test database migrations
- `/db-fix` — Fix database issues
- `/audit-auth` — Audit authentication
- `/parallel-auth` — Setup parallel auth
- `/session-restore` — Restore session state

---

---

## Recent Auth Architecture Changes (2026-04-21)

> **CRITICAL**: All AI agents must be aware of these changes before modifying auth-related code.

### Problem Fixed
Firefox's Enhanced Tracking Protection / Total Cookie Protection silently blocks cross-origin requests to `*.supabase.co`. This caused:
- Auth breaking after ~50 minutes (when auto-refresh fires)
- Data not loading until reload
- Firefox Dev Edition login loops

### Solution Implemented
1. **Same-origin refresh proxy**: `app/api/auth/refresh/route.ts` — server-side proxy that calls `supabase.auth.refreshSession()`
2. **Disabled auto-refresh**: `autoRefreshToken: false` in `app/utils/supabase/supabaseClient.ts`
3. **Updated `getAccessToken()`**: Calls `/api/auth/refresh` instead of direct `supabase.auth.refreshSession()`

### Key Patterns to Maintain
- **Never wrap Supabase auth calls with `Promise.race` / timeout** — creates zombie Web Lock holders
- **Always use `credentials: "same-origin"`** on `fetch` calls for cookie-based auth
- **`onAuthStateChange` subscription deps: `[supabase]` ONLY** — use refs for callbacks
- **Mount effect has 3-second UI safety timeout** — unblocks page if `getSession()` hangs
- **Tab visibility handler does NOT call `refreshSession()`** — only re-probes `/api/user/profile`

### Files to Touch Carefully
| File | Why |
|------|-----|
| `components/AuthProvider.tsx` | Complex auth state machine, easy to break Firefox compatibility |
| `app/utils/supabase/supabaseClient.ts` | Cookie options affect all auth sessions |
| `app/api/auth/refresh/route.ts` | Same-origin proxy — critical for Firefox support |
| `middleware.ts` | Session refresh on page loads |

### Emergency Rollback
```bash
git checkout 10729729bc7b78d4b0e61d9ffbe2d0a4e568fd1b -- components/AuthProvider.tsx
```

### Detailed Analysis
See `docs/AUTH_BUG_ANALYSIS.md` for full root-cause analysis, failed fixes, and lessons learned.

---

*Last synced from: `.claude/settings.json` (global) + `.claude/settings.local.json` (project) + `.cursor/mcp.json` + `.codex/config.toml`*
*Sync date: 2026-04-21*
