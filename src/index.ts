import { AugmentCache } from "./augment-cache";
import type { PiExec } from "./binary-resolver";
import { resolveBinary } from "./binary-resolver";
import { createGitNexusIndexCommand } from "./commands/gitnexus-index";
import { BinaryNotFoundError, MESSAGES } from "./errors";
import { createAugmentGrepHook } from "./hooks/augment-grep";
import { GitNexusMcpClient } from "./mcp-client";
import { resolveRepoRoot } from "./repo-resolver";
import { createGitNexusQueryTool } from "./tools/gitnexus-query";

/**
 * Structural type for the subset of `ExtensionAPI` we consume.
 * The real type comes from `@mariozechner/pi-coding-agent` at runtime;
 * the peer dep means we don't import it here to keep the compiled output
 * free of hard imports that would fail in isolation.
 */
type ExtensionAPI = {
	exec: PiExec;
	on: (event: string, handler: (...args: unknown[]) => unknown) => void;
	registerTool: (tool: unknown) => void;
	registerCommand: (name: string, opts: unknown) => void;
};

export default function gitnexusExtension(pi: ExtensionAPI): void {
	let client: GitNexusMcpClient | null = null;
	let binaryPath: string | null = null;
	const cache = new AugmentCache();

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

	pi.registerTool(createGitNexusQueryTool(() => client, resolveRepoRoot));
	pi.registerCommand(
		"gitnexus-index",
		createGitNexusIndexCommand(pi.exec.bind(pi) as PiExec, () => binaryPath),
	);

	const augmentHook = createAugmentGrepHook(() => client, cache);
	pi.on("tool_result", (...evArgs: unknown[]) => {
		const event = evArgs[0] as Parameters<typeof augmentHook>[0];
		return augmentHook(event);
	});
}
