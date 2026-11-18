# Britton Field MCP

Read-only [Model Context Protocol](https://modelcontextprotocol.io) server that lets an LLM query live Field app data in Supabase.

## What it exposes

| Tool | Purpose |
|------|---------|
| `field_summary` | Counts by status, today’s jobs, people, recent notices |
| `list_projects` | Filter/search jobs |
| `get_project` | Full job + contacts + crew |
| `list_people` | Directory / roles |
| `list_daily_logs` | Recent daily logs |
| `list_notices` | Site notices |
| `list_customer_communications` | Customer communication logs (job-scoped) |

Also includes prompt `field_ops_briefing` for a leadership-style demo.

Uses the **service role** key when present (bypasses RLS for demos). Keep that key local — never commit it. Talks to PostgREST over `fetch` (no Realtime), so it works on Node 20.

## Setup

Credentials are loaded from the Field app `.env.local` (parent folder):

- `VITE_SUPABASE_URL` (or `SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (preferred) or anon key

```bash
cd mcp
npm install
```

## Connect in Cursor

1. `cd mcp && npm install && npm run build`
2. Project config is `.cursor/mcp.json` — absolute path via ASCII symlink  
   `~/Projects/great-britton-field-app` → Field App (avoids `•` in path breaking Cursor)
3. Cursor Settings → MCP → reload **britton-field** (or restart Cursor)

Then in chat try:

> Using Britton Field MCP, give me a field ops briefing. What’s on hold and who’s on the team?

Approve tool calls when Cursor asks.

If the server shows an error: confirm `mcp/node_modules` exists, then toggle the server off/on again.

## Manual smoke test

```bash
cd mcp
npx @modelcontextprotocol/inspector --cli npm run start -- --protocol-era modern --method tools/list
```
