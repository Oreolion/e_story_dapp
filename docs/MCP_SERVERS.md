# MCP Servers Reference

Total servers configured: 34

## By Category

### Uncategorized

- **apify** — 3,000+ scrapers. Free: $5/mo credits
  - Package: `@apify/actors-mcp-server`
  - Env: APIFY_API_TOKEN
- **atlassian** — Jira search, tickets, sprints. Free: up to 10 users
  - Package: `atlassian-mcp-server`
  - Env: ATLASSIAN_API_TOKEN, ATLASSIAN_USER_EMAIL
- **bannerbear** — Automated image generation. Free: 30 images/mo. Package name UNVERIFIED
  - Package: `@bannerbear/mcp-server`
  - Env: BANNERBEAR_API_KEY
- **brave-search** — Independent web search. Paid: from $5/mo
  - Package: `@modelcontextprotocol/server-brave-search`
  - Env: BRAVE_API_KEY
- **bright-data** — Anti-bot bypass. Paid only. Package name UNVERIFIED
  - Package: `bright-data-mcp`
  - Env: BRIGHT_DATA_API_KEY
- **browserbase** — Cloud-hosted browser. Free: 100 sessions/mo. Package name UNVERIFIED
  - Package: `@browserbasehq/mcp-server-browserbase`
  - Env: BROWSERBASE_API_KEY
- **chroma** — Lightweight vector DB. Free & open-source. Package name UNVERIFIED
  - Package: `@chroma-core/chroma-mcp`
- **cloudflare** — Workers, KV, D1, DNS. Free tier available
  - Package: `@cloudflare/mcp-server-cloudflare`
  - Env: CLOUDFLARE_API_TOKEN
- **context7** — Live docs for any framework. Free & open-source. Package name UNVERIFIED — may need manual install from github:context-labs/context7
  - Package: `context7-mcp`
- **crawl4ai** — Free open-source crawling. Package name UNVERIFIED — Python-based, may need uvx/pipx
  - Package: `crawl4ai-mcp`
- **docker** — Container management. Free & open-source
  - Package: `docker-mcp`
- **exa** — Semantic search. Free: 1,000 searches/mo
  - Package: `exa-mcp-server`
  - Env: EXA_API_KEY
- **figma** — Design files to code. Free with Figma account
  - Package: `figma-mcp`
  - Env: FIGMA_ACCESS_TOKEN
- **firecrawl** — URL to clean markdown. Free: 500 lifetime credits. Package name UNVERIFIED
  - Package: `@mendable/firecrawl-mcp`
  - Env: FIRECRAWL_API_KEY
- **github** — PRs, issues, code search. Free with GitHub account
  - Package: `github-mcp-server`
  - Env: GITHUB_PERSONAL_ACCESS_TOKEN
- **grafana** — Query dashboards, check metrics. Free: Grafana Cloud. Package name UNVERIFIED
  - Package: `@grafana/mcp-server`
  - Env: GRAFANA_URL, GRAFANA_API_KEY
- **hubspot** — CRM through prompts. Free CRM available
  - Package: `hubspot-mcp-server`
  - Env: HUBSPOT_ACCESS_TOKEN
- **linear** — Issue tracking. Free tier available
  - Package: `linear-mcp-server`
  - Env: LINEAR_API_KEY
- **memory** — Persistent memory across sessions. Free & open-source
  - Package: `@modelcontextprotocol/server-memory`
- **mongodb** — Atlas management, aggregation. Free: 512MB cluster
  - Package: `@mongodb/mongodb-mcp-server`
  - Env: MONGODB_URI
- **neo4j** — Graph database queries. Free: community edition. Package name UNVERIFIED
  - Package: `@neo4j/neo4j-mcp-server`
  - Env: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
- **notion** — Documents, wikis, databases. Free tier available
  - Package: `@modelcontextprotocol/server-notion`
  - Env: NOTION_TOKEN
- **perplexity** — Answer-engine with deep research. Free tier available
  - Package: `perplexity-mcp`
  - Env: PERPLEXITY_API_KEY
- **pinecone** — Cloud vector search. Free: 2GB storage
  - Package: `pinecone-mcp`
  - Env: PINECONE_API_KEY
- **playwright** — Real Chrome browser control. Free & open-source
  - Package: `@modelcontextprotocol/server-playwright`
- **postgres** — Natural language DB queries. Free & open-source
  - Package: `@modelcontextprotocol/server-postgres`
  - Env: DATABASE_URL
- **qdrant** — Semantic memory & vector search. Free & open-source
  - Package: `qdrant-mcp-server`
  - Env: QDRANT_URL, QDRANT_API_KEY
- **slack** — Read threads, search, send messages. Free with workspace
  - Package: `@modelcontextprotocol/server-slack`
  - Env: SLACK_TOKEN
- **stripe** — Payments, subscriptions, invoices. Free: test mode
  - Package: `@stripe/agent-toolkit`
  - Env: STRIPE_SECRET_KEY
- **supabase** — Postgres + auth + storage. Free tier available
  - Package: `@supabase/mcp-server-supabase`
  - Env: SUPABASE_ACCESS_TOKEN
- **tavily** — AI-optimized web search. Free: 1,000 queries/mo
  - Package: `tavily-mcp`
  - Env: TAVILY_API_KEY
- **todoist** — Task management. Free tier available
  - Package: `todoist-mcp-server`
  - Env: TODOIST_API_TOKEN
- **vercel** — Deploy, logs, errors. Free tier available
  - Package: `vercel-mcp`
  - Env: VERCEL_TOKEN
- **zapier** — Automation across 6,000+ apps. Free: 100 tasks/mo. Package name UNVERIFIED
  - Package: `@zapier/zapier-mcp-server`
  - Env: ZAPIER_API_KEY

## Lean Config (Recommended Daily Use)

The `~/.kimi/mcp.json.lean` file contains only 10 essential servers to minimize token usage:
- n8n-mcp, sentry, x-mcp (existing)
- github, vercel, supabase, context7, tavily, firecrawl, playwright, memory

To switch to lean mode:
```powershell
Copy-Item ~/.kimi/mcp.json.lean ~/.kimi/mcp.json
```

To restore full config:
```powershell
# The full config is always in ~/.cursor/mcp.json and ~/.vscode/mcp.json
# For Kimi, regenerate with: python ~/tools/generate_mcp.py
```

## API Keys Needed

Fill these in your tool's MCP config (env vars) or in `.env` files:

- `APIFY_API_TOKEN`
- `ATLASSIAN_API_TOKEN`
- `ATLASSIAN_USER_EMAIL`
- `BANNERBEAR_API_KEY`
- `BRAVE_API_KEY`
- `BRIGHT_DATA_API_KEY`
- `BROWSERBASE_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `DATABASE_URL`
- `EXA_API_KEY`
- `FIGMA_ACCESS_TOKEN`
- `FIRECRAWL_API_KEY`
- `GITHUB_PERSONAL_ACCESS_TOKEN`
- `GRAFANA_API_KEY`
- `GRAFANA_URL`
- `HUBSPOT_ACCESS_TOKEN`
- `LINEAR_API_KEY`
- `MONGODB_URI`
- `NEO4J_PASSWORD`
- `NEO4J_URI`
- `NEO4J_USER`
- `NOTION_TOKEN`
- `PERPLEXITY_API_KEY`
- `PINECONE_API_KEY`
- `QDRANT_API_KEY`
- `QDRANT_URL`
- `SLACK_TOKEN`
- `STRIPE_SECRET_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `TAVILY_API_KEY`
- `TODOIST_API_TOKEN`
- `VERCEL_TOKEN`
- `ZAPIER_API_KEY`

## Token Warning

> Each MCP server loads its tool descriptions into context. 3-5 servers is the sweet spot. 
> Running all 35+ servers simultaneously will burn significant tokens per turn.
> Use the lean config for daily work, and only switch to full config when you need specific tools.