import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors";
import type { GitNexusMcpClient } from "../mcp-client";
import type { ToolDefinition } from "./gitnexus-query";
import { StringEnum } from "./typebox-utils";

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;
type ToolCtx = { cwd: string };
type ResolveRepo = (ctx: ToolCtx, override?: string) => string | null;

export function createGitNexusDetectChangesTool(
	client: ClientAccessor,
	resolveRepo: ResolveRepo,
): ToolDefinition {
	return {
		name: "tff-gitnexus_detect_changes",
		label: "GitNexus Detect Changes",
		description:
			"Detect which symbols and execution flows are affected by the current git diff. Use before committing to verify scope.",
		parameters: Type.Object({
			scope: Type.Optional(
				StringEnum(["unstaged", "staged", "all", "compare"], {
					description:
						"Diff scope: 'unstaged' (default), 'staged', 'all', or 'compare' (requires base_ref)",
				}),
			),
			base_ref: Type.Optional(
				Type.String({ description: "Git ref to compare against (only used with scope='compare')" }),
			),
			repo: Type.Optional(
				Type.String({ description: "Repo name or absolute path. Omit to auto-detect from cwd." }),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const current = client();
			if (!current) {
				throw new Error(MESSAGES.clientNotAvailable);
			}
			const p = params as { scope?: string; base_ref?: string; repo?: string };
			const resolved = resolveRepo(ctx as ToolCtx, p.repo);
			if (resolved === null) {
				throw new Error(MESSAGES.noIndexFound);
			}
			const args: Record<string, unknown> = { repo: resolved };
			if (p.scope !== undefined) args.scope = p.scope;
			if (p.base_ref !== undefined) args.base_ref = p.base_ref;
			const content = await current.callTool("detect_changes", args, signal);
			return {
				content,
				details: { scope: p.scope ?? "unstaged", repo: resolved },
			};
		},
	};
}
