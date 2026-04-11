import { statSync } from "node:fs";
import { join } from "node:path";
import { AugmentCache } from "./augment-cache";
import type { PiExec } from "./binary-resolver";
import { resolveBinary } from "./binary-resolver";
import { createGitNexusIndexCommand } from "./commands/gitnexus-index";
import { createGitNexusStatusCommand } from "./commands/gitnexus-status";
import { BinaryNotFoundError, MESSAGES } from "./errors";
import { createAugmentGrepHook } from "./hooks/augment-grep";
import { GitNexusMcpClient } from "./mcp-client";
import { resolveRepoRoot } from "./repo-resolver";
import { createGitNexusContextTool } from "./tools/gitnexus-context";
import { createGitNexusCypherTool } from "./tools/gitnexus-cypher";
import { createGitNexusDetectChangesTool } from "./tools/gitnexus-detect-changes";
import { createGitNexusImpactTool } from "./tools/gitnexus-impact";
import { createGitNexusListReposTool } from "./tools/gitnexus-list-repos";
import { createGitNexusQueryTool } from "./tools/gitnexus-query";
import { checkForUpdates } from "./update-check.js";

type ExtensionAPI = {
	exec: PiExec;
	on: (event: string, handler: (...args: unknown[]) => unknown) => void;
	registerTool: (tool: unknown) => void;
	registerCommand: (name: string, opts: unknown) => void;
};

function hasGitDir(cwd: string): boolean {
	try {
		return statSync(join(cwd, ".git")).isDirectory();
	} catch {
		return false;
	}
}

export default function gitnexusExtension(pi: ExtensionAPI): void {
	let client: GitNexusMcpClient | null = null;
	let binaryPath: string | null = null;
	let augmentEnabled = true;
	const cache = new AugmentCache();

	const clientAccessor = () => client;
	// DI seam: wrapping resolveRepoRoot lets tests inject a fake resolver
	// into tool/command factories without touching the real module.
	const resolveRepo = (ctx: { cwd: string }, override?: string) => resolveRepoRoot(ctx, override);

	pi.on("session_start", async (...evArgs: unknown[]) => {
		const ctx = evArgs[1] as {
			cwd: string;
			ui: { notify: (msg: string, level: "info" | "warning" | "error") => void };
		};
		try {
			binaryPath = await resolveBinary(pi.exec.bind(pi) as PiExec, process.env);
			client = new GitNexusMcpClient(binaryPath, ctx.cwd);
			await client.start();
			ctx.ui.notify(MESSAGES.extensionReady(binaryPath), "info");

			const maybeRepo = resolveRepoRoot({ cwd: ctx.cwd });
			if (maybeRepo === null && hasGitDir(ctx.cwd)) {
				ctx.ui.notify(MESSAGES.indexMissing, "info");
			}

			// Check for extension updates
			const updateInfo = await checkForUpdates(pi);
			if (updateInfo?.updateAvailable) {
				ctx.ui.notify(
					`📦 Update available: ${updateInfo.latestVersion} (you have ${updateInfo.currentVersion}). Run: pi install npm:@the-forge-flow/gitnexus-pi`,
					"info",
				);
			}
		} catch (err) {
			if (err instanceof BinaryNotFoundError) {
				ctx.ui.notify(MESSAGES.binaryNotFound, "warning");
			} else {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(MESSAGES.initFailed(msg), "warning");
			}
			client = null;
		}
	});

	pi.on("session_shutdown", async () => {
		await client?.close();
		client = null;
		cache.clear();
	});

	// Tools
	pi.registerTool(createGitNexusQueryTool(clientAccessor, resolveRepo));
	pi.registerTool(createGitNexusContextTool(clientAccessor, resolveRepo));
	pi.registerTool(createGitNexusImpactTool(clientAccessor, resolveRepo));
	pi.registerTool(createGitNexusCypherTool(clientAccessor, resolveRepo));
	pi.registerTool(createGitNexusDetectChangesTool(clientAccessor, resolveRepo));
	pi.registerTool(createGitNexusListReposTool(clientAccessor));

	// Commands
	pi.registerCommand(
		"gitnexus-index",
		createGitNexusIndexCommand(pi.exec.bind(pi) as PiExec, () => binaryPath),
	);
	pi.registerCommand(
		"gitnexus-status",
		createGitNexusStatusCommand({
			binaryPath: () => binaryPath,
			client: () => client,
			augmentEnabled: () => augmentEnabled,
			cache,
			resolveRepo,
		}),
	);
	pi.registerCommand("gitnexus-toggle-augment", {
		description: "Toggle the GitNexus auto-augment hook on/off for this session",
		handler: async (
			_args: string,
			ctx: { ui: { notify: (msg: string, level: string) => void } },
		) => {
			try {
				augmentEnabled = !augmentEnabled;
				ctx.ui.notify(augmentEnabled ? MESSAGES.augmentOn : MESSAGES.augmentOff, "info");
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(MESSAGES.toggleFailed(msg), "error");
			}
		},
	});

	// Hook
	const augmentHook = createAugmentGrepHook(clientAccessor, cache, () => augmentEnabled);
	pi.on("tool_result", (...evArgs: unknown[]) => {
		const event = evArgs[0] as Parameters<typeof augmentHook>[0];
		return augmentHook(event);
	});
}
