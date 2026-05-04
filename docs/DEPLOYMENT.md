# Production Deployment & DevOps Guide

This document describes the CI/CD pipeline, deployment process, and rollback procedures for the eStories web application.

---

## Architecture Overview

- **Platform**: Next.js 15 + React 19
- **Hosting**: Vercel (auto-deploy from Git)
- **CI/CD**: GitHub Actions
- **Error Tracking**: Sentry
- **Branching**: `master` is the production branch

---

## GitHub Actions Workflows

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | `.github/workflows/ci.yml` | Push/PR to `master` | Lint, typecheck, tests, build, contract compile |
| **Playwright Tests** | `.github/workflows/playwright.yml` | Push/PR to `master` | End-to-end browser tests |
| **Deploy & Verify** | `.github/workflows/deploy.yml` | After CI passes on `master` | Smoke tests, Sentry release |
| **Health Check** | `.github/workflows/health-check.yml` | Every 15 minutes | Production uptime monitoring |
| **Rollback** | `.github/workflows/rollback.yml` | Manual | Emergency rollback |
| **Claude Code** | `.github/workflows/claude.yml` | Issue/PR comments | AI assistant integration |
| **Claude Review** | `.github/workflows/claude-code-review.yml` | PR open/sync | Automated code review |

---

## Deployment Flow

### 1. Pull Request

When you open a PR against `master`:

1. **CI runs** — lint, typecheck, unit tests, build, contract compile
2. **Playwright runs** — E2E tests in real browsers
3. **Vercel Preview Deploy** — Vercel deploys a preview URL automatically
4. **All checks must pass** before merge (branch protection)

### 2. Merge to `master`

After PR is merged:

1. **CI runs again** on `master`
2. **Vercel Production Deploy** — auto-deploys to `https://estories.app`
3. **Deploy & Verify workflow**:
   - Waits 90 seconds for Vercel propagation
   - Smoke tests homepage, health API, library page
   - Creates a Sentry release with the commit SHA
4. If smoke tests fail, the workflow fails and logs an error

### 3. Health Monitoring

- Every **15 minutes**, the health check workflow pings production
- On failure, it automatically creates a GitHub Issue with `incident` and `production` labels

---

## Rollback Procedures

### Option A: Git Revert (Recommended)

Fastest and safest. Reverts the last commit on `master` and lets Vercel auto-deploy.

1. Go to **Actions > Rollback Production**
2. Select method: `git-revert`
3. Enter reason
4. Click **Run workflow**

The bot will:
- Revert `HEAD` on `master`
- Push the revert commit
- Vercel auto-deploys the previous version
- Create an incident issue

### Option B: Vercel Previous Deployment

Promotes the previous Vercel deployment without changing git history.

**Prerequisites:**
- Add `VERCEL_TOKEN` to GitHub repository secrets
- Add `VERCEL_ORG_ID` to GitHub repository secrets (optional)

1. Go to **Actions > Rollback Production**
2. Select method: `vercel-previous`
3. Enter reason
4. Click **Run workflow**

---

## Required GitHub Secrets

Configure these in **Settings > Secrets and variables > Actions**:

| Secret | Required For | How to Get |
|--------|-------------|------------|
| `SENTRY_AUTH_TOKEN` | Sentry release tracking | https://sentry.io/settings/account/api/auth-tokens/ (scopes: `project:releases`, `org:read`) |
| `VERCEL_TOKEN` | Vercel CLI rollback | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Vercel CLI rollback | From `vercel.json` or Vercel dashboard project settings |

---

## Branch Protection (Recommended)

In **Settings > Branches**, add a rule for `master`:

- ✅ **Require a pull request before merging**
- ✅ **Require status checks to pass before merging**
  - Select: `Lint`, `Type Check`, `Unit & Integration Tests`, `Build`, `Compile Contracts`
- ✅ **Require branches to be up to date before merging**
- ✅ **Restrict pushes that create files larger than 100 MB**

This prevents broken code from reaching production and stops incidents like the previous mobile-app merge that renamed build scripts.

---

## Local Development — Avoiding Timeouts

If `npm run build`, `npx tsc --noEmit`, or `npx vitest` timeout or crash with memory errors on Windows:

### 1. Increase Node.js Heap Size

Set in your PowerShell profile or before commands:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
```

Or add to `package.json` scripts (already applied to build in Next.js by default).

### 2. Use Background Tasks for Long Runs

In this CLI, use `run_in_background=true` for dev servers or long builds:

```powershell
# Background dev server
npm run dev

# Then manage via /task
```

### 3. Windows Page File

Your system already has a **48 GB auto-managed page file** — this is not the bottleneck. The timeouts are from Node.js heap limits and process startup overhead, not system memory.

---

## Incident Response Checklist

1. **Detect**: Health check fails or user reports issue
2. **Assess**: Check Sentry and Vercel dashboard for errors
3. **Mitigate**: Run **Rollback Production** GitHub Action if needed
4. **Investigate**: Check the commit that caused the issue
5. **Fix**: Open a PR with the fix, let CI validate
6. **Deploy**: Merge to `master`, verify smoke tests pass
7. **Document**: Update incident issue with root cause
