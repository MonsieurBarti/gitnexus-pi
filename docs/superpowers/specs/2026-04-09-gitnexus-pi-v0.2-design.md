# `@the-forge-flow/gitnexus-pi` v0.2.0 — Design Spec

**Date:** 2026-04-09
**Status:** Approved for planning
**Baseline:** v0.1.0 (branch `feature/v0.1.0`, HEAD `e19cc6d`)
**Target:** curated MVP — full v0.2 scope on top of v0.1, additive on the existing branch

---

## 1. Purpose

Expand v0.1's thin end-to-end slice into the curated MVP: more tools, smarter auto-augment coverage, user-facing status and toggle commands, session-start notification when the repo has no graph, shipped skill workflows, and observability for the previously opaque auto-augment hook. Every v0.2 change sits on top of v0.1 — no rewrites — and preserves v0.1's architectural invariants (never-throw commands/hooks, DI everywhere, hand-rolled fakes, `.spec.ts` naming, centralized MESSAGES catalog).

### v0.2 scope (this spec)

**Tools — 5 new + 1 upgrade:**
- `tff-gitnexus_context` — 360° symbol view (callers/callees/cluster/file)
- `tff-gitnexus_impact` — blast radius for proposed changes (upstream/downstream)
- `tff-gitnexus_cypher` — raw Cypher escape hatch over the graph
- `tff-gitnexus_detect_changes` — git diff → affected processes
- `tff-gitnexus_list_repos` — enumerate all indexed repos
- `tff-gitnexus_query` — param expansion: `task_context`, `goal`, `include_content`

**Commands — 2 new:**
- `/gitnexus-status` — binary + repo + MCP state + augment enabled/disabled + per-session counters + cache size
- `/gitnexus-toggle-augment` — session-only in-memory toggle for the augment hook

**Auto-augment hook expansion:**
- Fires on `grep` + `find` + `read` instead of `grep` only
- Tool-specific path extraction (grep/find parse `event.content`; read reads `event.input.path`)
- Toggle-gated via new `augmentEnabled` closure flag
- `AugmentCache` extended with success/failure/cache-hit counters feeding `/gitnexus-status`
- `GITNEXUS_PI_DEBUG=1` env var surfaces silent failures via `console.error`

**session_start enhancement:**
- After successful binary + MCP client start, if cwd has `.git/` but no `.gitnexus/`, notify once: `MESSAGES.indexMissing`

**Shipped skills — 3 new:**
- `skills/scope-refactor/SKILL.md`
- `skills/pre-commit-review/SKILL.md`
- `skills/explore-codebase/SKILL.md`
- Authored in compressed-notation style (symbol table, phase-structured body, R1–RN transformation rules, trigger phrases baked into description frontmatter)
- `package.json` gains `pi.skills: ["./skills"]` and `files` array extended to `["dist", "README.md", "LICENSE", "skills"]`

**New infrastructure:**
- `src/repo-resolver.ts` — central `resolveRepoRoot(ctx, override?)` helper used by every tool
- `repo-discovery.ts` wired for the first time (v0.1 follow-up #7 closed)

**v0.1 coverage gaps closed:**
- `mcp-client.ts` 72% → ≥95% (add `onError` signal cleanup test + `onExit` listener verification)
- `augment-grep.ts` 88% → ≥95% (defensive `Array.isArray` guard test if missing)
- `gitnexus-index.ts` 80% → ≥95% (non-`GitignoreGuardError` path)

### v0.2 non-goals (explicit)

- `rename`, `route_map`, `tool_map`, `shape_check`, `api_impact` tool wrappers (v0.3)
- Persisted augment toggle (v0.3 if users ask)
- Bash result auto-augmentation (too fuzzy — v0.3 if needed)
- Live status streaming for `gitnexus analyze` (still `pi.exec` buffered)
- MCP client auto-restart on child death (v0.3)
- Integration tests with real `gitnexus` in CI (v0.3)

### Hard constraints

- **Additive on `feature/v0.1.0`** — every v0.2 change is a new commit. No rewriting of existing modules except narrow upgrades (`query` tool param expansion, `augment-grep` hook expansion, `index.ts` wiring).
- TDD throughout — every new `src/*.ts` gets a matching `.spec.ts` under `tests/unit/` with at least the cases listed in §6.
- Commands and hooks **never throw**. Tools DO throw (PI marks `isError: true`).
- No ad-hoc user-facing strings — every `notify` and `throw` message comes from `MESSAGES`.
- Coverage floor: every `src/` file except `src/index.ts` reaches ≥95% branches.

---

## 2. Architecture

Every v0.2 change is narrow and local. The module tree grows, but existing files change minimally.

### Module tree diff

```
src/
├── index.ts                          # MODIFIED — wire new tools/commands, toggle state, notify
├── errors.ts                         # MODIFIED — 3 new MESSAGES entries
├── augment-cache.ts                  # MODIFIED — add counters + clear reset
├── repo-discovery.ts                 # UNCHANGED — now used via repo-resolver
├── repo-resolver.ts                  # NEW — central resolveRepoRoot
├── binary-resolver.ts                # UNCHANGED
├── mcp-client.ts                     # UNCHANGED (coverage tests added in §6)
├── gitignore-guard.ts                # UNCHANGED
├── tools/
│   ├── gitnexus-query.ts             # MODIFIED — new params + resolveRepoRoot integration
│   ├── gitnexus-context.ts           # NEW
│   ├── gitnexus-impact.ts            # NEW
│   ├── gitnexus-cypher.ts            # NEW
│   ├── gitnexus-detect-changes.ts    # NEW
│   └── gitnexus-list-repos.ts        # NEW
├── commands/
│   ├── gitnexus-index.ts             # UNCHANGED (coverage tests added in §6)
│   └── gitnexus-status.ts            # NEW
└── hooks/
    └── augment-grep.ts               # MODIFIED — grep + find + read + toggle + counters

skills/                               # NEW DIRECTORY
├── scope-refactor/SKILL.md
├── pre-commit-review/SKILL.md
└── explore-codebase/SKILL.md

package.json                          # MODIFIED — pi.skills, files[+skills]
```

### File naming decision

`src/hooks/augment-grep.ts` keeps its name despite now handling grep + find + read. Reason: rename churn vs clarity trade-off — the file path stays stable, git blame is cleaner, and imports in `src/index.ts` don't need to change. The minor naming drift is lower cost than the rename.

### Accessor pattern (unchanged from v0.1)

Every new tool factory takes a client closure accessor `() => Pick<GitNexusMcpClient, "callTool"> | null`. The status command takes deps as an object. The augment hook gains one more accessor: `() => boolean` for `augmentEnabled`. All state lives in the `index.ts` factory closure; nothing imports state from other modules.

### Toggle state lives in the factory

```ts
// In src/index.ts factory
let augmentEnabled = true;

pi.registerCommand("gitnexus-toggle-augment", {
	description: "Toggle the GitNexus auto-augment hook on/off for this session",
	handler: async (_args, ctx) => {
		augmentEnabled = !augmentEnabled;
		ctx.ui.notify(
			augmentEnabled ? "GitNexus augment: on" : "GitNexus augment: off",
			"info",
		);
	},
});
```

The hook closes over `() => augmentEnabled` and bails out early when false.

---

## 3. Components

### 3.1 `src/repo-resolver.ts` (NEW)

```ts
import { findGitNexusRoot } from "./repo-discovery";

type RepoContext = { cwd: string };

export function resolveRepoRoot(ctx: RepoContext, override?: string): string | null {
	if (override !== undefined && override.length > 0) return override;
	return findGitNexusRoot(ctx.cwd);
}
```

Pure, synchronous, no side effects, no dependencies beyond `repo-discovery`. Every new tool (except `gitnexus-list-repos`) calls it as the first line of `execute`.

### 3.2 `src/errors.ts` (MODIFIED)

Adds three `MESSAGES` entries. No new error classes.

```ts
noIndexFound: `No .gitnexus/ index found for this directory. Run /gitnexus-index first. ${INSTALL_HINT}`,
indexMissing: "GitNexus has no index for this repo — run /gitnexus-index to enable graph queries and auto-augment.",
augmentDisabled: "GitNexus augment hook is disabled for this session (re-enable with /gitnexus-toggle-augment)",
```

Two "no index" messages are intentional: `noIndexFound` is LLM-facing (tool throws), `indexMissing` is user-facing (session notify).

### 3.3 `src/augment-cache.ts` (MODIFIED — counters)

```ts
export class AugmentCache {
	private readonly set = new Set<string>();
	private _successes = 0;
	private _failures = 0;
	private _cacheHits = 0;

	has(key: string): boolean {
		const hit = this.set.has(key);
		if (hit) this._cacheHits++;
		return hit;
	}

	add(key: string): void { this.set.add(key); }
	clear(): void {
		this.set.clear();
		this._successes = 0;
		this._failures = 0;
		this._cacheHits = 0;
	}

	recordSuccess(): void { this._successes++; }
	recordFailure(): void { this._failures++; }

	get size(): number { return this.set.size; }
	get successes(): number { return this._successes; }
	get failures(): number { return this._failures; }
	get cacheHits(): number { return this._cacheHits; }
}
```

Counter semantics:
- `_cacheHits` increments on every `has(key)` that returns true — the hook calls `has()` exactly once per extracted path.
- `_successes` increments when an MCP call returns non-empty content AND contributes to the augment block.
- `_failures` increments on MCP call rejection, empty result, or timeout.
- `clear()` resets all counters in addition to the set — called on `session_shutdown`.

### 3.4 `src/tools/gitnexus-query.ts` (MODIFIED)

Param expansion adds three optional fields: `task_context`, `goal`, `include_content`. Factory signature adds a `resolveRepo` parameter:

```ts
export function createGitNexusQueryTool(
	client: ClientAccessor,
	resolveRepo: (ctx: ToolCtx, override?: string) => string | null,
): ToolDefinition
```

`execute` calls `resolveRepo(ctx, params.repo)`. If it returns null, throws `Error(MESSAGES.noIndexFound)`. Otherwise passes the resolved path as `repo` to `client.callTool("query", ...)`.

All new params are forwarded to the upstream `query` tool only when defined (no nulls passed through).

### 3.5 `src/tools/gitnexus-context.ts` (NEW)

Parameters: `name?`, `uid?`, `file_path?`, `include_content?`, `repo?`.

Runtime guard in `execute`: at least one of `name` or `uid` must be set (TypeBox can't express "one-of" elegantly), otherwise throws `Error("tff-gitnexus_context requires either 'name' or 'uid'")`.

Calls `client.callTool("context", { ... })` with the resolved repo and forwarded params. Same `resolveRepo`-null → `noIndexFound` behavior.

### 3.6 `src/tools/gitnexus-impact.ts` (NEW)

Parameters:
- `target: string` (required)
- `direction: "upstream" | "downstream"` (required, via `StringEnum` from `@mariozechner/pi-ai`)
- `maxDepth?: number` (1-10, default upstream's 3)
- `relationTypes?: string[]`
- `includeTests?: boolean`
- `minConfidence?: number` (0-1)
- `repo?: string`

TypeBox enforces the two required params. `execute` resolves repo, then calls `client.callTool("impact", ...)` forwarding all non-null params.

### 3.7 `src/tools/gitnexus-cypher.ts` (NEW)

Parameters: `query: string` (required), `repo?: string`.

Description warns the LLM to read `gitnexus://repo/{name}/schema` first. Simplest new tool. `execute` resolves repo, calls `client.callTool("cypher", { query, repo })`.

### 3.8 `src/tools/gitnexus-detect-changes.ts` (NEW)

Parameters:
- `scope?: "unstaged" | "staged" | "all" | "compare"` (default `"unstaged"`, via `StringEnum`)
- `base_ref?: string`
- `repo?: string`

`execute` resolves repo, forwards all non-null params to `client.callTool("detect_changes", ...)`.

### 3.9 `src/tools/gitnexus-list-repos.ts` (NEW)

No parameters. **Does NOT call `resolveRepoRoot`** — listing repos is a global operation. If the client is null, throws `clientNotAvailable`. Otherwise calls `client.callTool("list_repos", {})` and returns the content.

### 3.10 `src/commands/gitnexus-status.ts` (NEW)

Dependencies injected as an object:

```ts
type StatusCommandDeps = {
	binaryPath: () => string | null;
	client: () => (Pick<GitNexusMcpClient, "callTool"> & { dead: boolean }) | null;
	augmentEnabled: () => boolean;
	cache: AugmentCache;
	resolveRepo: (ctx: { cwd: string }, override?: string) => string | null;
};

export function createGitNexusStatusCommand(deps: StatusCommandDeps): CommandDefinition;
```

**Output format** — single multi-line info notify:

```
GitNexus status:
  Binary:        /path/to/gitnexus (or: not installed)
  MCP client:    running | not started | dead
  Current repo:  /path/to/indexed/repo (or: no index — run /gitnexus-index)
  Augment hook:  on | off
  This session:
    augmented:   N paths
    cache hits:  M paths
    failures:    K paths
    cache size:  S paths
```

No MCP calls. No fs calls beyond `resolveRepo`. Pure string formatting. Never throws (command rule) — wrapped in outer try/catch that notifies error + returns.

### 3.11 `src/hooks/augment-grep.ts` (MODIFIED — expand to grep + find + read)

```ts
const HOOKED_TOOLS = new Set(["grep", "find", "read"]);

return async (event) => {
	if (!HOOKED_TOOLS.has(event.toolName) || event.isError) return undefined;
	if (!augmentEnabled()) return undefined;
	if (!Array.isArray(event.content)) return undefined;
	const client = clientAccessor();
	if (!client) return undefined;

	const paths = extractPaths(event);
	if (paths.length === 0) return undefined;

	// ...rest mirrors v0.1 but with recordSuccess/recordFailure/debug channel
};
```

`extractPaths` dispatches on `event.toolName`:

```ts
const GREP_PATTERN = /^([^\s:]+):\d+:/;
const FIND_PATTERN = /^(.+)$/;

function extractPaths(event: ToolResultEvent): string[] {
	switch (event.toolName) {
		case "grep":
			return extractFromContentLines(event.content, GREP_PATTERN, MAX_PATHS);
		case "find":
			return extractFromContentLines(event.content, FIND_PATTERN, MAX_PATHS);
		case "read":
			return extractFromReadInput(event.input);
		default:
			return [];
	}
}

function extractFromReadInput(input: unknown): string[] {
	if (typeof input !== "object" || input === null) return [];
	const path = (input as { path?: unknown }).path;
	return typeof path === "string" && path.length > 0 ? [path] : [];
}
```

**Counter instrumentation** on every `Promise.allSettled` result:
- fulfilled + non-empty aggregated text → `cache.add(filePath)` + `cache.recordSuccess()`
- fulfilled + empty text → `cache.recordFailure()`
- rejected → `cache.recordFailure()`
- `cache.has(path)` returning true → already counted inside `has()`

**Debug channel** — if `process.env.GITNEXUS_PI_DEBUG === "1"`, rejection cases also `console.error(reason)`. Never notifies, never throws.

**Toggle guard** — `augmentEnabled()` is the second early return (after toolName guard). Disabling the hook mid-session takes effect on the very next matching tool result.

### 3.12 `src/index.ts` (MODIFIED — wire everything)

Adds to the v0.1 factory:
- `let augmentEnabled = true` closure variable
- 5 new tool imports and registrations, each receiving `resolveRepoRoot` as a collaborator
- `gitnexus-toggle-augment` and `gitnexus-status` command registrations
- Extended `session_start` handler that calls `resolveRepoRoot({ cwd: ctx.cwd })` after successful MCP start; if null and `hasGitDir(ctx.cwd)`, notifies `MESSAGES.indexMissing`
- Tiny `hasGitDir(cwd)` helper inline:

```ts
function hasGitDir(cwd: string): boolean {
	try {
		return statSync(join(cwd, ".git")).isDirectory();
	} catch {
		return false;
	}
}
```

Factory grows from ~70 lines to ~120 lines. Still logic-free — every branch delegates to another module.

### 3.13 `skills/` directory (NEW)

Three `SKILL.md` files. Each ~60-90 lines. No TypeScript, no tests — PI discovers them via `package.json`'s `pi.skills` field.

**Required frontmatter fields** (per PI skill spec):
- `name` — must equal parent directory name, lowercase `[a-z0-9-]`, max 64 chars
- `description` — max 1024 chars, sits in the system prompt, determines when the LLM loads the skill. Trigger phrases are baked in as pipe-separated quoted strings.
- `allowed-tools` — space-separated list of tool names the skill is permitted to invoke
- Optional: `license`, `compatibility`, `disable-model-invocation`

**Body style** (Roxabi compress-skill authoring style): dense formal notation, symbol table at top, phase-structured ("1 — Resolve / 2 — Analyze / 3 — Transform"), transformation/recipe rules as R1–RN, minimal prose, maximum signal. No `$ARGUMENTS` (Claude Code primitive — not supported by PI).

**Skill content overview:**

- **`scope-refactor`** — scope a refactor with impact analysis. Uses: `tff-gitnexus_impact`, `tff-gitnexus_context`, `tff-gitnexus_query`. Triggers: `"refactor" | "rename" | "scope refactor" | "safe refactor" | "impact" | "blast radius"`.
- **`pre-commit-review`** — review changes before committing. Uses: `tff-gitnexus_detect_changes`, `tff-gitnexus_impact`, `tff-gitnexus_context`. Triggers: `"pre-commit" | "review changes" | "what breaks" | "what am i changing" | "impact of diff"`.
- **`explore-codebase`** — understand an unfamiliar codebase. Uses: `tff-gitnexus_cypher`, `tff-gitnexus_query`, `tff-gitnexus_context`, `tff-gitnexus_list_repos`. Triggers: `"explore" | "understand" | "new codebase" | "orient" | "what does this do"`.

Every skill exercises the full curated v0.2 tool surface across the three combined, so the skills double as documentation of when to use what.

### 3.14 `package.json` (MODIFIED)

```json
{
	"files": ["dist", "README.md", "LICENSE", "skills"],
	"pi": {
		"extensions": ["./dist/index.js"],
		"skills": ["./skills"]
	}
}
```

Two changes: `files` adds `"skills"` so the directory ships to npm, and `pi` adds a `skills` array pointing PI at the directory for auto-discovery.

---

## 4. Data flow

### 4.1 New tool call flow (context / impact / cypher / detect_changes / list_repos)

Uniform shape across all 5 new tools (except `list_repos` skips the resolver):

1. LLM invokes `tff-gitnexus_X` with params.
2. Tool `execute` reads `client = clientAccessor()`. If null → throw `Error(MESSAGES.clientNotAvailable)`.
3. Tool calls `resolveRepo(ctx, params.repo)` (skipped for `list_repos`).
4. If resolver returns null (and not `list_repos`) → throw `Error(MESSAGES.noIndexFound)`.
5. Tool builds upstream args object with resolved `repo` + all non-null forwarded params.
6. Tool calls `client.callTool(upstream, args, signal)`, awaits content array.
7. Tool returns `{ content, details: { ...relevant input echo } }`.

**Failure branches:**
- Client null → throw with install hint.
- Resolver null (except `list_repos`) → throw `noIndexFound`.
- Missing required runtime param (context's name/uid requirement) → throw descriptive error.
- `client.callTool` rejects → re-throw `McpClientError`.
- Abort → propagated via `client.callTool(..., signal)` as in v0.1.

### 4.2 Augment hook expansion flow

Same shape as v0.1 hook, but with the three new early exits (`augmentEnabled`, new `extractPaths` dispatch) and counter instrumentation on every outcome.

**New branches specific to v0.2:**
- `augmentEnabled()` returns false → undefined (first meaningful return after tool/error guards).
- `event.toolName === "find"` → extract paths via `FIND_PATTERN` (every line is a raw path).
- `event.toolName === "read"` → extract the single path from `event.input.path`, skip content parsing entirely.
- Cache hit on `has(path)` → implicitly increments `_cacheHits` counter inside the cache.
- Promise fulfilled with non-empty text → `cache.recordSuccess()` + `cache.add(path)`.
- Promise fulfilled with empty text → `cache.recordFailure()`.
- Promise rejected → `cache.recordFailure()`. If `GITNEXUS_PI_DEBUG=1` → also `console.error(reason)`.

**Silent-on-failure invariant preserved** — every failure path returns `undefined` or records a counter. No throws, no notifies, no host tool corruption.

### 4.3 `/gitnexus-status` flow

1. User invokes `/gitnexus-status`.
2. Handler wraps the body in try/catch (never-throw rule).
3. Reads 5 accessors + 4 cache getters synchronously.
4. Computes derived fields (`mcpState`, `currentRepo`, `augmentHook`).
5. Formats single multi-line string.
6. Calls `ctx.ui.notify(msg, "info")`.
7. Returns.

No MCP calls. No fs calls beyond `resolveRepo`. No subprocess spawns. O(1) time.

**Failure branch**: any formatter error → catch → `ctx.ui.notify("gitnexus-status failed: ${msg}", "error")` → return.

### 4.4 `/gitnexus-toggle-augment` flow

1. User invokes `/gitnexus-toggle-augment`.
2. Handler flips `augmentEnabled = !augmentEnabled` in factory closure.
3. Notifies `"GitNexus augment: on"` or `"GitNexus augment: off"` (info level).
4. Returns.

Next `tool_result` event hits the hook's `augmentEnabled()` guard and bails (if off) or continues (if on).

### 4.5 Extended `session_start` flow

At the end of the v0.1 session_start flow (after `notify(extensionReady)`):

1. `maybeRepo = resolveRepoRoot({ cwd: ctx.cwd })`
2. If `maybeRepo !== null` → silent (graph is ready).
3. If `maybeRepo === null` AND `hasGitDir(ctx.cwd)` → `ctx.ui.notify(MESSAGES.indexMissing, "info")`.
4. If `maybeRepo === null` AND no `.git/` → silent (not a git repo, no point suggesting /gitnexus-index).

Fires once per session. Re-triggered by `/reload` → `/new` → `/resume` → `/fork`.

### 4.6 Extended `session_shutdown` flow

v0.1 already clears `cache` on shutdown. v0.2 `clear()` additionally resets counters. No new flow — just a bigger side effect inside the existing call.

### 4.7 Skill discovery flow

PI handles it entirely. We ship `skills/<name>/SKILL.md` + `pi.skills` manifest entry + `files: ["skills"]` in package.json. PI walks the directory on load, reads each `SKILL.md`, registers `/skill:<name>`, injects descriptions into the system prompt.

---

## 5. Error handling

No new error classes. Three new `MESSAGES` entries. Two new throw sites in tools. Commands and hooks keep their v0.1 invariants.

### 5.1 New MESSAGES (see §3.2)

- `noIndexFound` — LLM-facing, thrown by tools
- `indexMissing` — user-facing, notified at session_start
- `augmentDisabled` — not currently thrown or notified anywhere; reserved for potential v0.3 use (e.g., a dialog explaining why the hook is silent)

### 5.2 Error handling rules per surface

| Surface | New scenario | Behavior |
|---|---|---|
| 5 new tools | `resolveRepoRoot` returns null (not `list_repos`) | Throw `Error(MESSAGES.noIndexFound)` |
| `gitnexus-context` tool | Neither `name` nor `uid` provided | Throw descriptive Error |
| 5 new tools | Client null | Throw `Error(MESSAGES.clientNotAvailable)` |
| 5 new tools | `callTool` rejects with `McpClientError` | Re-throw |
| `/gitnexus-status` | Any formatting error | Catch → notify error → return |
| `/gitnexus-toggle-augment` | N/A (cannot fail) | Still wrap in defensive try/catch |
| Augment hook | `augmentEnabled === false` | Return undefined |
| Augment hook | Any failure | Return undefined, record counter, optionally console.error if debug |
| session_start | `resolveRepoRoot` null AND `.git/` exists | notify `indexMissing` |
| session_start | no `.git/` | Silent |

### 5.3 Inviolable rules (unchanged)

1. **Commands never throw.** Both new commands wrap their handlers in try/catch.
2. **Hooks never throw.** The expanded augment hook preserves silent-on-failure.
3. **Tools DO throw.** All 5 new tools throw on client-null, no-index, missing required runtime params, and upstream errors.

### 5.4 Abort handling (unchanged)

All 5 new tools accept `signal` and forward it via `client.callTool(..., signal)`. v0.1's MCP client already handles abort cleanup.

### 5.5 Child death handling (unchanged)

No auto-restart in v0.2. Tool calls still throw `McpClientError` on death; `dead` flag still blocks subsequent calls until next session_start.

### 5.6 Observability channel

Single env var: `GITNEXUS_PI_DEBUG=1`. Read directly inside the hook (not from the factory — picks up env changes without reloading). When set AND hook records a failure, `console.error` the rejection reason. Zero cost when unset.

---

## 6. Testing strategy

Same patterns as v0.1 (TDD, hand-rolled fakes, DI, `.spec.ts`, no mocking library). Test count roughly doubles.

### 6.1 New and modified spec files

**New:**
- `tests/unit/repo-resolver.spec.ts`
- `tests/unit/tools/gitnexus-context.spec.ts`
- `tests/unit/tools/gitnexus-impact.spec.ts`
- `tests/unit/tools/gitnexus-cypher.spec.ts`
- `tests/unit/tools/gitnexus-detect-changes.spec.ts`
- `tests/unit/tools/gitnexus-list-repos.spec.ts`
- `tests/unit/commands/gitnexus-status.spec.ts`
- `tests/unit/fakes/resolve-repo-fake.ts`

**Modified:**
- `tests/unit/augment-cache.spec.ts` — counter cases
- `tests/unit/tools/gitnexus-query.spec.ts` — new param cases + `resolveRepo` DI
- `tests/unit/hooks/augment-grep.spec.ts` — find + read + toggle + counter cases + debug env var
- `tests/unit/mcp-client.spec.ts` — coverage gap closures
- `tests/unit/commands/gitnexus-index.spec.ts` — coverage gap closure

### 6.2 Required test cases per new spec

**`repo-resolver.spec.ts`** (3 cases):
1. Returns override when non-empty string provided
2. Falls back to `findGitNexusRoot` when override undefined or empty
3. Returns null when no override AND no `.gitnexus/` anywhere in walk

**`tools/gitnexus-context.spec.ts`** (8 cases):
1. Tool name `tff-gitnexus_context`, label `"GitNexus Context"`
2. Happy path with `name` only
3. Happy path with `uid` only
4. Both `name` and `file_path` forwarded
5. `include_content: true` forwarded
6. Throws when neither `name` nor `uid` provided
7. Throws `noIndexFound` when resolver null
8. Re-throws `McpClientError` from client

**`tools/gitnexus-impact.spec.ts`** (6 cases):
1. Tool name + label
2. Happy path with required `target` + `direction`
3. Optional params forwarded when set (maxDepth, relationTypes, includeTests, minConfidence)
4. Throws `noIndexFound` when resolver null
5. Client null → `clientNotAvailable`
6. Re-throws upstream errors

**`tools/gitnexus-cypher.spec.ts`** (5 cases):
1. Tool name + label
2. Happy path — query forwarded
3. Resolver null → `noIndexFound`
4. Client null → `clientNotAvailable`
5. Upstream error re-thrown

**`tools/gitnexus-detect-changes.spec.ts`** (6 cases):
1. Tool name + label
2. Happy path with default scope (`"unstaged"`)
3. Explicit scope + `base_ref` forwarded
4. Each scope enum value accepted
5. Resolver null → `noIndexFound`
6. Upstream error re-thrown

**`tools/gitnexus-list-repos.spec.ts`** (4 cases):
1. Tool name + label
2. Happy path — no params, calls `client.callTool("list_repos", {})`
3. **Does NOT call `resolveRepoRoot`** — verify resolver is never invoked
4. Client null → `clientNotAvailable`

**`commands/gitnexus-status.spec.ts`** (8 cases):
1. Happy path — all deps return values, notify contains all sections
2. Binary not installed → formats "not installed"
3. Client null → formats "not started"
4. Client dead → formats "dead"
5. No indexed repo → formats "no index — run /gitnexus-index"
6. Augment disabled → formats "off"
7. Non-zero counters → formats each with the right count
8. Never throws — inject a fake accessor that throws → still notifies error + returns

### 6.3 Modified spec updates

**`tools/gitnexus-query.spec.ts`** — existing 6 cases + 3 new:
1. `task_context` and `goal` passed through when set
2. `include_content: true` passed through
3. `resolveRepoRoot` called with `params.repo` as override; returns null → throws `noIndexFound`

**`hooks/augment-grep.spec.ts`** — existing 11 cases + ~6 new:
1. `find` event with multi-line path content → enriched
2. `find` event with zero paths → undefined
3. `read` event with `event.input.path` → enriched
4. `read` event with missing `input.path` → undefined
5. `augmentEnabled()` returns false → undefined (early bail)
6. Counter instrumentation — `recordSuccess`/`recordFailure`/`cacheHits` bumped on right paths
7. `GITNEXUS_PI_DEBUG=1` + failure → `console.error` called (mock via `vi.spyOn(console, "error")`)

**`augment-cache.spec.ts`** — existing 6 cases + 4 new:
1. `recordSuccess` bumps `successes` getter
2. `recordFailure` bumps `failures` getter
3. `has()` on present key bumps `cacheHits`
4. `clear()` resets all counters in addition to clearing the set

**`mcp-client.spec.ts`** — 2 new cases:
1. `onError` cleanup when pending call has active signal (mirrors the v0.1 Task 9 fix for `onExit`)
2. `onExit` removeEventListener verified by asserting listener count or via a spy

**`commands/gitnexus-index.spec.ts`** — 1 new case:
1. `ensureGitnexusIgnored` throws non-`GitignoreGuardError` (raw `Error`) → command notifies generic error + returns without throwing

### 6.4 New fake

**`tests/unit/fakes/resolve-repo-fake.ts`**:

```ts
export function createFakeResolveRepo(result: string | null) {
	const calls: Array<{ cwd: string; override?: string }> = [];
	const fn = (ctx: { cwd: string }, override?: string): string | null => {
		calls.push({ cwd: ctx.cwd, override });
		return override !== undefined && override.length > 0 ? override : result;
	};
	return Object.assign(fn, { calls });
}
```

Used by every new tool spec to inject scripted repo resolution without touching the filesystem.

### 6.5 Coverage targets

- **v0.1 floor**: every `src/` file except `src/index.ts` at ≥95% branches.
- **v0.2 surface**: every new `src/` file starts at 100% branches (achievable — small and fully injected).
- **Aspirational**: 100% branches on everything except `index.ts`. Easier in v0.2 because we now know what's hard to test (child exit races).

### 6.6 Test count projection

| | v0.1 | v0.2 delta | v0.2 total |
|---|---|---|---|
| Tests | 72 | +~55 | ~127 |
| Spec files | 9 | +7 new, 4 modified | 16 |
| Fakes | 2 | +1 | 3 |

### 6.7 TDD discipline (unchanged)

No production code without a failing test first. Each new module red → green → refactor → commit.

### 6.8 Integration tests (still non-goal)

v0.2 does not add integration tests with a real `gitnexus` binary. v0.3.

---

## 7. Scaffolding

Minimal changes beyond new files:

| File | Change |
|---|---|
| `package.json` | Add `"skills"` to `files`, add `"skills": ["./skills"]` under `pi` |
| `skills/` | New directory at repo root with 3 skill subdirectories |

No new dev dependencies. No new scripts. No new CI workflows. No new biome rules. No new vitest config (the existing `tests/**/*.spec.ts` include already picks up every new spec file).

---

## 8. Definition of Done for v0.2.0

All of the following must be true before cutting v0.2.0:

- [ ] 5 new `src/tools/*.ts` files with 1:1 spec files, all green
- [ ] `src/repo-resolver.ts` + spec, green
- [ ] `src/commands/gitnexus-status.ts` + spec, green
- [ ] `src/hooks/augment-grep.ts` expanded for grep + find + read, spec extended
- [ ] `src/augment-cache.ts` counters added, spec extended
- [ ] `src/errors.ts` 3 new MESSAGES entries
- [ ] `src/tools/gitnexus-query.ts` param expansion + resolveRepoRoot integration, spec extended
- [ ] `src/index.ts` wires 7 new registrations + session_start notify + toggle state
- [ ] 3 `skills/*/SKILL.md` files authored in compressed notation style
- [ ] `package.json` `pi.skills` and `files` updated
- [ ] `bun run check` passes (biome lint + format)
- [ ] `bun run build` produces `dist/` successfully; build artifacts include all new modules
- [ ] `bun test` passes in lefthook pre-commit
- [ ] `bun run test:coverage` shows every `src/` file (except `index.ts`) at ≥95% branches
- [ ] `bun pm pack --dry-run` shows `dist/`, `README.md`, `LICENSE`, `skills/` — and NOTHING ELSE
- [ ] GitHub Actions CI green on `feature/v0.1.0` branch
- [ ] v0.1 follow-up #7 closed (repo-discovery wired via repo-resolver)
- [ ] v0.1 follow-up #8 closed (all 3 coverage gaps)
- [ ] README updated with v0.2 feature list (commands section, new tools, auto-augment coverage, status command)
- [ ] Manual smoke test: `/gitnexus-status` returns all sections correctly in a real PI session
- [ ] Manual smoke test: `/gitnexus-toggle-augment` toggles and `/gitnexus-status` reflects the new state
- [ ] Manual smoke test: `tff-gitnexus_impact` returns real blast radius data on an indexed repo
- [ ] Manual smoke test: `grep`/`find`/`read` all show `--- GitNexus context ---` block
- [ ] Manual smoke test: opening PI in a non-indexed git repo fires the `indexMissing` notify once

---

## 9. Open follow-ups (v0.3, out of scope for this spec)

- `rename` tool wrapper (needs file-mutation queue integration, dry-run defaults, safety dialog)
- `route_map`, `tool_map`, `shape_check`, `api_impact` tool wrappers (niche API-analysis value)
- Persisted augment toggle (if dogfooding shows users want it across sessions)
- Bash result auto-augmentation (requires fuzzy file-path extraction heuristics + safety guards)
- MCP client auto-restart on unexpected child death (heuristic retry with exponential backoff)
- Live status streaming for `gitnexus analyze` (swap `pi.exec` → raw `spawn` + status widget)
- Integration tests in CI with gitnexus preinstalled (dedicated job with cached npm global install)
- Plannotator integration for `/gitnexus-status` output rendering (nicer than a plain notify)

---

## Appendix A — Reference material

- **v0.1 design spec**: `docs/superpowers/specs/2026-04-09-gitnexus-pi-extension-design.md` — the baseline this spec extends.
- **PI extension docs (local)**: `/Users/monsieurbarti/.nvm/versions/node/v22.22.2/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- **PI extension examples (local)**: `/Users/monsieurbarti/.nvm/versions/node/v22.22.2/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/`
- **PI skills docs**: `~/.nvm/.../@mariozechner/pi-coding-agent/docs/skills.md`
- **GitNexus MCP tool definitions (local, v1.5.3)**: `/Users/monsieurbarti/.nvm/versions/node/v22.22.2/lib/node_modules/gitnexus/dist/mcp/tools.js`
- **Skill authoring style reference**: `Roxabi/roxabi-plugins/plugins/compress/skills/compress/SKILL.md` — dense formal notation, phase-structured, symbol table, transformation rules.
- **v0.1 dogfooding observations** (2026-04-09): augment hook works end-to-end; gap observation re: silent failures being indistinguishable from "no matches" — addressed by counters + debug env var in v0.2.
