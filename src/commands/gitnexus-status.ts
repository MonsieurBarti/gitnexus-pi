import type { AugmentCache } from "../augment-cache";
import { MESSAGES } from "../errors";
import type { CommandDefinition } from "./gitnexus-index";

type StatusCommandDeps = {
	binaryPath: () => string | null;
	client: () => { dead: boolean } | null;
	augmentEnabled: () => boolean;
	cache: AugmentCache;
	resolveRepo: (ctx: { cwd: string }, override?: string) => string | null;
};

export function createGitNexusStatusCommand(deps: StatusCommandDeps): CommandDefinition {
	return {
		description:
			"Show GitNexus extension status: binary, MCP client, repo, augment hook, and session counters",
		async handler(_args, ctx) {
			try {
				const binary = deps.binaryPath();
				const c = deps.client();
				const repo = deps.resolveRepo({ cwd: ctx.cwd });
				const augment = deps.augmentEnabled();

				const mcpState = c === null ? "not started" : c.dead ? "dead" : "running";
				const repoLine = repo ?? "no index — run /gitnexus-index";
				const augmentLine = augment ? "on" : "off";

				const msg = [
					"GitNexus status:",
					`  Binary:        ${binary ?? "not installed"}`,
					`  MCP client:    ${mcpState}`,
					`  Current repo:  ${repoLine}`,
					`  Augment hook:  ${augmentLine}`,
					"  This session:",
					`    augmented:   ${deps.cache.successes} paths`,
					`    cache hits:  ${deps.cache.cacheHits} paths`,
					`    failures:    ${deps.cache.failures} paths`,
					`    cache size:  ${deps.cache.size} paths`,
				].join("\n");

				ctx.ui.notify(msg, "info");
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(MESSAGES.statusFailed(msg), "error");
			}
		},
	};
}
