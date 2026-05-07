# Workflows & Prompt Templates

## Prompt Templates

Reusable prompts for common workflows. Copy, fill in the `[placeholder]`, and paste.

### Multi-Part Implementation with Checkpoints
```
I need to fix [describe multi-part issue]. Create a comprehensive implementation
plan where EACH task includes: 1) The specific code change, 2) A verification
command or test I can run to confirm it works, 3) Rollback instructions if it fails.
Use TodoWrite to track progress. Then execute the plan autonomously—after each task,
run its verification before moving to the next. If verification fails, fix it before
proceeding. Commit working changes incrementally so progress isn't lost if we hit limits.
```

### Autonomous Auth Debugging with Browser Testing
```
Debug the auth state sync issue between Google OAuth and wallet connection. Work
autonomously using this approach: 1) Use Playwright to navigate to the app and
attempt the OAuth flow while monitoring network requests, 2) Read the auth-related
source files to understand the state management, 3) Identify where race conditions
could occur, 4) Implement a fix, 5) Use Playwright again to verify the fix works
end-to-end. Document each browser test result. Don't stop to confirm with me—complete
the full investigation and fix cycle.
```

### Autonomous Test Fixing
```
I have failing tests related to [describe issue]. Your goal is to make all tests
pass autonomously. Run the test suite, analyze failures, implement fixes, and iterate
until green. Use this workflow: 1) Run `npm test` to see current failures, 2) Read
relevant source files, 3) Implement a fix, 4) Run tests again, 5) Repeat until all
pass. Don't stop to ask me questions—make your best judgment and keep iterating.
If you hit a dead end after 3 attempts on the same issue, document what you tried
and move on.
```

### Database Constraint Fix
```
Fix this database error. Before implementing, list ALL unique constraints on the
affected table(s) and ensure the fix handles conflicts on each one, not just the
primary key.
```

### Security Review Before Implementation
```
Before implementing this fix, do a quick security review: What auth tokens/sessions
are involved? What could go wrong if this races with another auth flow? Any concerns
I should know about before you start coding?
```

### Vault Encryption Debugging
```
Debug a vault encryption issue. Work autonomously:
1) Check if the vault is set up (isVaultSetup) and unlocked (isVaultUnlocked) for the user
2) Verify the IndexedDB schema matches lib/vault/db.ts (3 stores: stories, vaultKeys, syncQueue)
3) Check if window.crypto.subtle is available (requires HTTPS or localhost)
4) Test encrypt/decrypt round-trip using encryptString/decryptString
5) Verify DEK is in memory (getDEK should not throw)
6) Check for Dexie version conflicts or IndexedDB quota errors
```

### Phased Task Breakdown
```
I need to fix [X]. Before starting, break this into 2-3 phases where each phase
ends with something testable. We'll verify each phase works before moving to the next.
```

## Headless Mode Commands

Run focused tasks non-interactively to avoid session interruptions.

### Quick Commands
```bash
# Run tests and report failures
claude -p "run vitest and report any failures" --allowedTools "Bash,Read" --max-turns 5

# Fix lint errors
claude -p "fix eslint errors in app/api/" --allowedTools "Bash,Read,Edit" --max-turns 10

# Check migration status
claude -p "List all Supabase migrations and verify story_metadata table exists" \
  --allowedTools "Bash,Read,mcp__supabase__list_migrations,mcp__supabase__execute_sql" \
  --max-turns 5

# Quick security review
claude -p "Review app/api/auth/ for security vulnerabilities" --allowedTools "Read,Grep" --max-turns 5

# Run vault tests
claude -p "run vault-related tests in __tests__/vault/ and report results" \
  --allowedTools "Bash,Read" --max-turns 5
```

> **Note:** `window.crypto.subtle` is only available in secure contexts (HTTPS or localhost). Vault features will not work on plain HTTP deployments.

### Database Operations
```bash
# Run migrations and verify
claude -p "run database migrations and verify with a test query" \
  --allowedTools "Bash,Read,mcp__supabase__list_migrations,mcp__supabase__execute_sql" \
  --max-turns 10

# Check constraints before fix
claude -p "List ALL unique constraints on the users table" \
  --allowedTools "mcp__supabase__execute_sql,Read" --max-turns 3
```

### Flags Reference
| Flag | Purpose |
|------|---------|
| `-p "..."` | The prompt/task to execute |
| `--allowedTools` | Restricts which tools Claude can use |
| `--max-turns` | Limits API round-trips (prevents runaway sessions) |
| `--dangerously-skip-permissions` | Run without permission prompts (use with caution) |

## Advanced Autonomous Workflows

### Autonomous Test-Driven Bug Resolution
```
I have failing tests related to [describe issue]. Your goal is to make all tests
pass autonomously. Run the test suite, analyze failures, implement fixes, and iterate
until green. Use this workflow:
1) Run `npx vitest run` to see current failures
2) Read relevant source files
3) Implement a fix
4) Run tests again
5) Repeat until all pass

Don't stop to ask me questions—make your best judgment and keep iterating.
If you hit a dead end after 3 attempts on the same issue, document what you tried
and move on. Commit working changes incrementally so progress isn't lost.
```

### Parallel Investigation with Browser Verification
```
Debug [describe issue]. Work autonomously using this approach:
1) Use Playwright to navigate to the app and attempt the flow while monitoring
   network requests
2) Read the related source files to understand the state management
3) Identify where issues could occur
4) Implement a fix
5) Use Playwright again to verify the fix works end-to-end

Document each browser test result. Don't stop to confirm with me—complete the
full investigation and fix cycle.
```

### Comprehensive Fix Plan with Verification
```
I need to fix [describe multi-part issue]. Create a comprehensive implementation
plan where EACH task includes:
1) The specific code change
2) A verification command or test I can run to confirm it works
3) Rollback instructions if it fails

Use TodoWrite to track progress. Then execute the plan autonomously—after each
task, run its verification before moving to the next. If verification fails, fix
it before proceeding. Commit working changes incrementally so progress isn't lost
if we hit limits.
```


---

## CI/CD Workflow & Merge Rules

> **Effective**: 2026-05-05  
> **Applies to**: All branches, all contributors, all AI agents

### Branch Protection (Enforced on `master`)

| Rule | Setting | Why |
|------|---------|-----|
| Require PR | ✅ Mandatory | All changes must go through pull request |
| Required reviews | 1 approving review | Prevents unilateral changes |
| Dismiss stale reviews | ✅ Enabled | Forces re-review after new commits |
| Strict status checks | ✅ Enabled | PR branch must be up-to-date with `master` |
| Block force pushes | ✅ Enabled | Prevents `git push --force` |
| Block deletions | ✅ Enabled | Prevents accidental branch deletion |

### Required Status Checks

These **must pass** before a PR can merge:

| Check | Source | Scope |
|-------|--------|-------|
| **Lint** | `ci.yml` | Web/shared files only (`paths-ignore: mobile/**`) |
| **Type Check** | `ci.yml` | Web/shared files only |
| **Unit & Integration Tests** | `ci.yml` | Web/shared files only |
| **Build** | `ci.yml` | Web/shared files only (depends on Lint + Type Check + Test) |
| **Compile Contracts** | `ci.yml` | Web/shared files only |
| **Mobile Type Check** | `mobile-ci.yml` | Mobile files only (`paths: mobile/**`) |
| **Mobile Build Verification** | `mobile-ci.yml` | Mobile files only (depends on Mobile Type Check) |

**Key behavior**: Mobile-only PRs only run Mobile CI. Web-only PRs only run Web CI. Mixed PRs run both.

### Pre-Merge Checklist (Mandatory)

Before creating a PR or requesting review:

```markdown
- [ ] Branch is up to date with `origin/master`
- [ ] `npm run lint` passes (from project root)
- [ ] `npx tsc --noEmit` passes (from project root for web)
- [ ] `cd mobile && npx tsc --noEmit` passes (for mobile changes)
- [ ] Tests pass (`npm test`)
- [ ] `package-lock.json` is in sync with `package.json`
- [ ] No secrets or `.env` values committed
- [ ] Mobile changes are isolated to `/mobile/` directory
- [ ] Commit messages follow conventional format (`feat:`, `fix:`, `docs:`, `chore:`)
```

### Merge Process

1. **Create feature branch** from latest `master`
2. **Make changes** following the checklist above
3. **Push branch** and open PR via GitHub or `gh pr create`
4. **Wait for all status checks** to pass (CI runs automatically)
5. **Request review** (or self-review if solo)
6. **Merge via squash** to keep history clean
7. **Delete feature branch** after merge

### Lockfile Rule (Critical)

**Any PR that modifies `package.json` must include the updated `package-lock.json`.**

Failure to do this causes `npm ci` to fail with:
```
npm error `npm ci` can only install packages when your package.json
and package-lock.json or npm-shrinkwrap.json are in sync.
```

**Fix**: Run `npm install` locally and commit the updated lockfile.

### Mobile-Specific Rules

| Rule | Rationale |
|------|-----------|
| Mobile changes stay in `/mobile/` | Isolates mobile CI from web CI |
| Don't modify root `package.json` from mobile branch | Root deps affect web CI; coordinate changes |
| Mobile deps go in `mobile/package.json` | Separate dependency tree |
| Run `cd mobile && npx tsc --noEmit` before pushing | Catches TypeScript errors early |

### Breaking Changes & Version Checks

Before using APIs from dependencies:
1. Check the installed version in `package.json`
2. Verify the API matches that version's documentation
3. Major version bumps (e.g., Zod v3 → v4) often have breaking changes

**Recent example**: Zod v4 renamed `result.error.errors` to `result.error.issues` — caused CI failures in PR #10.

### Emergency Overrides

Branch protection can be bypassed with `gh pr merge --admin` **only** for:
- Hotfixes to production
- Reverting broken commits
- Lockfile sync fixes

All admin merges must be documented in the PR description.
