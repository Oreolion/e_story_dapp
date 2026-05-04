# Contributing to eStory (Speak Your Story)

Thank you for your interest in contributing! We welcome improvements, bug fixes, and ideas. This document explains how to contribute so your changes are easy to review and merge.

## Table of contents

- [First steps](#first-steps)
- [How to contribute](#how-to-contribute)
- [Branching & commit messages](#branching--commit-messages)
- [Code style & linting](#code-style--linting)
- [Testing locally](#testing-locally)
- [Pull request checklist](#pull-request-checklist)
- [Security issues](#security-issues)
- [Communication](#communication)
- [References](#references)

## First steps

1. Fork the repository on GitHub.
2. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/web3_Ai_eStory.git
cd i_story_dapp
```

1. Install dependencies:

```bash
npm install
# or: yarn install / pnpm install
```

1. Create a branch for your work:

```bash
git checkout -b feature/your-short-description
```

## How to contribute

- Open an issue first for major features or breaking changes to discuss design and scope.
- For small fixes (typos, docs, small bugfixes), open a pull request directly referencing the issue (if any).
- Keep PRs focused and small — one logical change per PR.

## Branching & commit messages

- Use descriptive branch names: `feature/`, `fix/`, `chore/`, `docs/`.
- Use Conventional Commits style for commit messages. Example:

```text
feat(record): add real-time transcription indicator
fix(api): handle empty audio uploads gracefully
docs: update contributing guidelines
```

## Code style & linting

- The project uses TypeScript, ESLint, and Prettier. Run lint and format before submitting:

```bash
npm run lint
npm run lint:fix
# format as required by the repo (Prettier integration if available)
```

- Keep changes aligned with existing patterns (React + Next.js App Router, Tailwind classes, shadcn/ui components).

## Testing locally

- Start the dev server:

```bash
npm run dev
```

- Run lint checks:

```bash
npm run lint
```

- If running end-to-end tests are added, use Playwright:

```bash
npx playwright test
```

Add tests where applicable and ensure existing tests pass.

## Pull request checklist

Before requesting review, ensure:

- [ ] Code builds and runs locally
- [ ] Linting passes (`npm run lint`) and formatting is applied
- [ ] Tests added/updated where relevant and passing
- [ ] PR description explains the *why* and *what* (include screenshots for UI changes)
- [ ] Any required environment variables or setup steps documented

## Security issues

If you discover a security vulnerability, please do not open a public issue. Instead email the maintainers at `security@estory.app` with details so we can triage and patch privately.

## Communication

- For questions and community discussion: join the project's Discord or GitHub Discussions (see `README.md` for links).
- Keep interactions respectful and follow the `docs/CODE_OF_CONDUCT.md`.

## References

- `README.md` — project overview, setup, and architecture
- `docs/CODE_OF_CONDUCT.md` — contributor behavior expectations
- LICENSE — project license (MIT)

Thank you for making eStory better! 🎙️📚
