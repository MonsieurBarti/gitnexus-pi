import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { PiExec } from "../binary-resolver";
import { GitignoreGuardError, MESSAGES } from "../errors";
import { ensureGitnexusIgnored } from "../gitignore-guard";
import { GITNEXUS_STORAGE_PATH } from "../repo-discovery";

type CommandCtx = {
	cwd: string;
	signal?: AbortSignal;
	ui: { notify: (message: string, level: "info" | "warning" | "error") => void };
};

export type CommandDefinition = {
	description: string;
	handler: (args: string, ctx: CommandCtx) => Promise<void>;
};

type BinaryAccessor = () => string | null;

/**
 * Command: `/gitnexus-index [repoPath?]`
 * - Ensures `.gitnexus/` is in .gitignore at repoRoot
 * - Runs `gitnexus analyze` via pi.exec in that directory
 * - Never throws — all failures become notify() calls
 */
export function createGitNexusIndexCommand(
	exec: PiExec,
	binaryPath: BinaryAccessor,
): CommandDefinition {
	return {
		description: "Run `gitnexus analyze` in the current repo and ensure `.gitnexus/` is gitignored",
		async handler(args, ctx) {
			const repoRoot = args.trim().length > 0 ? args.trim() : ctx.cwd;
			try {
				await runHandler(exec, binaryPath, repoRoot, ctx);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`gitnexus-index unexpected error: ${msg}`, "error");
			}
		},
	};
}

async function runHandler(
	exec: PiExec,
	binaryPath: BinaryAccessor,
	repoRoot: string,
	ctx: CommandCtx,
): Promise<void> {
	// 1. Gitignore guard first.
	try {
		const outcome = ensureGitnexusIgnored(repoRoot);
		if (outcome === "created") {
			ctx.ui.notify(MESSAGES.gitignoreCreated, "info");
		} else if (outcome === "added") {
			ctx.ui.notify(MESSAGES.gitignoreAdded, "info");
		}
	} catch (err) {
		const msg = err instanceof GitignoreGuardError ? err.message : String(err);
		ctx.ui.notify(`gitignore guard failed: ${msg}`, "error");
		return;
	}

	// 2. Binary check.
	const binary = binaryPath();
	if (!binary) {
		ctx.ui.notify(MESSAGES.binaryNotFoundForCommand, "error");
		return;
	}

	// 3. Run analyze using the resolved binary path.
	//    --skip-agents-md: do not write AGENTS.md / CLAUDE.md / .claude/skills/ into the repo.
	//    Only .gitnexus/ (the graph database) should be produced.
	const result = await exec(binary, ["analyze", "--skip-agents-md"], {
		cwd: repoRoot,
		signal: ctx.signal,
	});
	if (result.killed) {
		ctx.ui.notify(MESSAGES.indexingCancelled, "warning");
		return;
	}
	if (result.code !== 0) {
		const tail = (result.stderr ?? "").trim().slice(-1000);
		ctx.ui.notify(MESSAGES.indexingFailed(tail), "error");
		return;
	}

	// 4. Move .gitnexus to .pi/.gitnexus for cleaner project structure.
	moveToPiDirectory(repoRoot);

	// 5. Update the global registry to point to the new location.
	updateRegistry(repoRoot);

	ctx.ui.notify(MESSAGES.indexReady(repoRoot), "info");
}

/**
 * Move .gitnexus/ to .pi/.gitnexus/ after indexing.
 * Creates .pi/ directory if needed, and handles the move atomically.
 */
function moveToPiDirectory(repoRoot: string): void {
	const resolvedRoot = resolve(repoRoot);
	const oldPath = join(resolvedRoot, ".gitnexus");
	const piDir = join(resolvedRoot, ".pi");
	const newPath = join(piDir, ".gitnexus");

	// Skip if already at the preferred location
	if (existsSync(newPath)) {
		return;
	}

	// Skip if no .gitnexus was created (shouldn't happen, but be safe)
	if (!existsSync(oldPath)) {
		return;
	}

	// Ensure .pi/ directory exists
	if (!existsSync(piDir)) {
		mkdirSync(piDir, { recursive: true });
	}

	// Move the directory
	renameSync(oldPath, newPath);
}

/**
 * Update the global registry (~/.gitnexus/registry.json) to point to the new
 * storage path (.pi/.gitnexus instead of .gitnexus).
 */
function updateRegistry(repoRoot: string): void {
	const resolvedRoot = resolve(repoRoot);
	const registryPath = join(homedir(), ".gitnexus", "registry.json");

	if (!existsSync(registryPath)) {
		return;
	}

	try {
		// Read and parse the registry
		const raw = readFileSync(registryPath, "utf-8");
		const registry = JSON.parse(raw) as Array<{
			name: string;
			path: string;
			storagePath: string;
			[key: string]: unknown;
		}>;

		// Find and update the entry for this repo
		const oldStoragePath = join(resolvedRoot, ".gitnexus");
		const newStoragePath = join(resolvedRoot, GITNEXUS_STORAGE_PATH);

		let updated = false;
		for (const entry of registry) {
			if (entry.path === resolvedRoot || entry.storagePath === oldStoragePath) {
				entry.storagePath = newStoragePath;
				updated = true;
			}
		}

		// Write back if changed
		if (updated) {
			writeFileSync(registryPath, JSON.stringify(registry, null, 2));
		}
	} catch {
		// Silently ignore registry update failures - the MCP server can still
		// find repos via path matching, and manual `gitnexus index` can fix it.
	}
}
