<div align="center">
  <img src="https://raw.githubusercontent.com/MonsieurBarti/The-Forge-Flow-CC/refs/heads/main/assets/forge-banner.png" alt="The Forge Flow" width="100%">
  
  <h1>🔧 GitNexus PI Extension Template</h1>
  
  <p>
    <strong>Starter kit for building PI coding agent extensions</strong>
  </p>
  
  <p>
    <a href="https://github.com/MonsieurBarti/gitnexus-pi/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MonsieurBarti/gitnexus-pi/ci.yml?label=CI&style=flat-square" alt="CI Status">
    </a>
    <a href="https://www.npmjs.com/package/@the-forge-flow/gitnexus-pi">
      <img src="https://img.shields.io/npm/v/@the-forge-flow/gitnexus-pi?style=flat-square" alt="npm version">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/github/license/MonsieurBarti/gitnexus-pi?style=flat-square" alt="License">
    </a>
  </p>
</div>

---

## What it does

PI extension that integrates [GitNexus](https://github.com/abhigyanpatwari/GitNexus) code-intelligence natively into the [pi-mono coding agent](https://github.com/badlogic/pi-mono). Gives the LLM structural code queries (symbols, callers, clusters) via a persistent MCP stdio client, and passively enriches `grep` results with graph context.

**Status:** v0.1.0 — thin end-to-end slice. One tool, one command, one auto-augment hook.

## Features

- `tff-gitnexus_query` — LLM-callable symbol/file/concept search over the GitNexus knowledge graph
- `/gitnexus-index` — one-shot command that ensures `.gitnexus/` is gitignored and runs `gitnexus analyze` on the current repo
- **Auto-augment hook** — enriches PI's `grep` results with a GitNexus context block (enabled by default, per-session dedup cache)
- Persistent `gitnexus mcp` child process owned by the extension — single handshake, fast repeated tool calls
- Graceful degradation when `gitnexus` is not installed — notify once, tools return install hint

## Installation

**1. Install GitNexus** (not bundled — it is [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)):

```bash
npm install -g gitnexus
```

**2. Install the extension in PI:**

```bash
pi install npm:@the-forge-flow/gitnexus-pi
```

**3. Index your repo** (first time only, or after significant changes):

```
/gitnexus-index
```

## Usage

### Querying the graph from the LLM

Once your repo is indexed, the agent can call `tff-gitnexus_query` at any time during a session:

```
Tool: tff-gitnexus_query
Arguments: { "query": "UserRepository.findById" }
```

Optional arguments:
- `repo` — explicit path to the indexed repo (defaults to auto-detect from cwd)
- `limit` — max results, 1-50, default 10

### Commands

- `/gitnexus-index` — runs `gitnexus analyze` in the current directory. Adds `.gitnexus/` to `.gitignore` if missing.
- `/gitnexus-index /path/to/other/repo` — index a different directory.

### Auto-augmentation

When PI's built-in `grep` tool returns results, this extension passively looks up the top file paths in the GitNexus graph and appends a **GitNexus context** block to the tool result. The LLM sees this automatically — no separate tool call needed.

A per-session dedup cache prevents re-augmenting the same file path twice in one session. Failures are silent — `grep` never breaks.

## Configuration

### `GITNEXUS_PATH`

Override the binary location (useful for nvm/fnm/volta setups that PI can't discover on its own):

```bash
export GITNEXUS_PATH=/Users/me/.nvm/versions/node/v22/bin/gitnexus
```

Binary resolution order: `GITNEXUS_PATH` → `which gitnexus` → `/bin/sh -lc 'command -v gitnexus'`.

## Architecture

```
┌─────────────────────┐
│ PI host process     │
│ └─ loads extension  │
└─────────┬───────────┘
          │  session_start
          ▼
┌─────────────────────────────────────────────────────┐
│ gitnexus-pi extension (in PI process)               │
│   BinaryResolver  →  GitNexusMcpClient              │
│                      │                              │
│   Tool: query ───────┼─ callTool("query", ...)      │
│   Command: index ───→│ pi.exec("gitnexus analyze")  │
│   Hook: grep_result ─┤ callTool("query", basename)  │
└──────────────────────┼──────────────────────────────┘
                       │ JSON-RPC 2.0 stdio
                       ▼
              ┌──────────────────┐
              │ gitnexus mcp     │
              │ (child process)  │
              └──────────────────┘
```

Key components in `src/`:

| File | Purpose |
|---|---|
| `src/index.ts` | Extension factory — session hooks, tool/command/hook registration |
| `src/binary-resolver.ts` | Locate `gitnexus` binary (env → which → login shell) |
| `src/mcp-client.ts` | Persistent JSON-RPC client over `gitnexus mcp` stdio |
| `src/tools/gitnexus-query.ts` | `tff-gitnexus_query` tool definition |
| `src/commands/gitnexus-index.ts` | `/gitnexus-index` handler with `.gitignore` guard |
| `src/hooks/augment-grep.ts` | `tool_result` middleware enriching grep output |
| `src/gitignore-guard.ts` | Detect/add `.gitnexus/` to `.gitignore` |
| `src/repo-discovery.ts` | Walk up from cwd looking for `.gitnexus/` |
| `src/augment-cache.ts` | Per-session dedup set for the hook |
| `src/errors.ts` | Error classes + user-facing message catalog |

## Development

```bash
bun install              # install deps
bun test                 # run vitest once
bun test:watch           # vitest watch mode
bun test:coverage        # v8 coverage
bun run check            # biome lint + format
bun run check:fix        # auto-fix
bun run build            # tsc → dist/
bun run typecheck        # type-only check
```

Pre-commit hooks (lefthook) run `bun run check` and `bun test` automatically.

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint.

## Roadmap

**v0.2.0** (next):

- Curated 5-7 tool surface: `gitnexus_context`, `gitnexus_impact`, `gitnexus_cypher`, `gitnexus_detect_changes`, `gitnexus_list_repos`, `gitnexus_status`
- `/gitnexus-status` and `/gitnexus-toggle-augment` commands
- Auto-augment across `find` / `read` / `bash` in addition to `grep`
- Shipped SKILL.md workflow guides
- MCP client auto-restart on unexpected child death
- Live status streaming for `gitnexus analyze`

## License

MIT for this extension (see [`LICENSE`](./LICENSE)).

**GitNexus itself is licensed under [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)** and must be installed separately via `npm i -g gitnexus`. This extension does not bundle or redistribute GitNexus.
