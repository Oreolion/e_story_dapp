# Kimi Code CLI — Project-Level Configuration

This file provides Kimi-specific overrides and references for the iStory DApp project.

## Parent Configuration

**READ FIRST**: `../AGENTS.md` — The unified agent configuration governing ALL agents on this project.
This file only contains Kimi-specific additions and overrides.

## Kimi-Specific Preferences

- **Default model**: `kimi-code/kimi-for-coding` (Kimi-k2.6)
- **Thinking**: Always enabled unless user explicitly disables
- **Plan mode**: Use EnterPlanMode for non-trivial features (>3 files, architectural decisions, unclear requirements)

## Subagent Delegation (Kimi-specific)

Kimi has three built-in subagent types. Use them following the delegation rules in `../AGENTS.md`:

### `explore` — Read-Only Codebase Investigation
Use for: Finding files, searching code, understanding modules, answering "how does X work?"
```
Agent({
  subagent_type: "explore",
  prompt: "Find all usages of useAuth hook and explain the auth flow",
  description: "Explore auth patterns"
})
```

### `coder` — General Software Engineering
Use for: Implementing features, fixing bugs, running commands, editing code
```
Agent({
  subagent_type: "coder",
  prompt: "Fix the TypeScript error in lib/auth.ts by adding null checks",
  description: "Fix auth null checks"
})
```

### `plan` — Implementation Planning
Use for: Creating step-by-step plans before making changes
```
Agent({
  subagent_type: "plan",
  prompt: "Plan the implementation of a new audiobook player component",
  description: "Plan audiobook player"
})
```

## Background Tasks

Kimi supports `run_in_background: true` on `Shell` and `Agent` tools.
- Max concurrent: 4
- Use for: Long builds, test suites, independent explorations
- Always provide `description` for background Shell tasks
- Manage with `/task` command (human) or `TaskList` / `TaskOutput` / `TaskStop` tools (agent)

## Skills Integration

Kimi Code CLI automatically loads skills from:
1. `C:\Users\HP 240 G9\.claude\skills\` (global)
2. `C:\Users\HP 240 G9\Desktop\Web3\web3_Ai_iStory\i_story_dapp\.claude\skills\` (project)

All skills listed in `../AGENTS.md` are available. Use them by referencing the skill name in your request or letting the system auto-detect based on keywords.

## MCP Integration

Kimi Code CLI can use MCP servers configured in the environment. The project has:
- Playwright MCP (browser automation)
- Supabase MCP (database/auth)
- Sentry MCP (error monitoring)

## Hooks Note

Kimi does not natively support the same PreToolUse/PostToolUse hook system as Claude Code.
However, the security principles from `../AGENTS.md` still apply:
- NEVER read `.env` files (use `.env.example` as reference)
- NEVER run destructive `rm -rf` on root/home/parent directories
- NEVER force push to main/master
- NEVER run `curl | bash`
- Run `npx tsc --noEmit` after milestone edits

## Cross-Agent Sync

When working with `.ai-sync/`:
- Identify yourself as `last_agent: kimi-code`
- Follow the exact protocol in `../AGENTS.md` and `~/.claude/rules/ai-sync-protocol.md`
