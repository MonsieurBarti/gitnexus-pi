import type { PiExec } from "../binary-resolver.ts";
import { GitignoreGuardError, MESSAGES } from "../errors.ts";
import { ensureGitnexusIgnored } from "../gitignore-guard.ts";

type CommandCtx = {
	cwd: string;
	signal?: AbortSignal;
	ui: { notify: (message: string, level: "info" | "warn" | "error") => void };
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

	// 3. Run analyze.
	const result = await exec("gitnexus", ["analyze"], { cwd: repoRoot, signal: ctx.signal });
	if (result.killed) {
		ctx.ui.notify(MESSAGES.indexingCancelled, "warn");
		return;
	}
	if (result.code !== 0) {
		const tail = (result.stderr ?? "").trim().slice(-1000);
		ctx.ui.notify(MESSAGES.indexingFailed(tail), "error");
		return;
	}
	ctx.ui.notify(MESSAGES.indexReady(repoRoot), "info");
}
