import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors";
import type { GitNexusMcpClient } from "../mcp-client";
import type { ToolDefinition } from "./gitnexus-query";

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;
type ToolCtx = { cwd: string };
type ResolveRepo = (ctx: ToolCtx, override?: string) => string | null;

export function createGitNexusContextTool(
	client: ClientAccessor,
	resolveRepo: ResolveRepo,
): ToolDefinition {
	return {
		name: "tff-gitnexus_context",
		label: "GitNexus Context",
		description:
			"Get a 360° view of a symbol: callers, callees, cluster membership, file location, and execution flow participation. Provide either name or uid.",
		parameters: Type.Object({
			name: Type.Optional(Type.String({ description: "Symbol name to look up" })),
			uid: Type.Optional(Type.String({ description: "Unique graph identifier for the symbol" })),
			file_path: Type.Optional(
				Type.String({
					description: "Disambiguate by file path when multiple symbols share a name",
				}),
			),
			include_content: Type.Optional(
				Type.Boolean({ description: "Include source code snippet (default false)" }),
			),
			repo: Type.Optional(
				Type.String({ description: "Repo name or absolute path. Omit to auto-detect from cwd." }),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const p = params as {
				name?: string;
				uid?: string;
				file_path?: string;
				include_content?: boolean;
				repo?: string;
			};
			if (!p.name && !p.uid) {
				throw new Error("tff-gitnexus_context requires either 'name' or 'uid'");
			}
			const current = client();
			if (!current) {
				throw new Error(MESSAGES.clientNotAvailable);
			}
			const resolved = resolveRepo(ctx as ToolCtx, p.repo);
			if (resolved === null) {
				throw new Error(MESSAGES.noIndexFound);
			}
			const args: Record<string, unknown> = { repo: resolved };
			if (p.name !== undefined) args.name = p.name;
			if (p.uid !== undefined) args.uid = p.uid;
			if (p.file_path !== undefined) args.file_path = p.file_path;
			if (p.include_content !== undefined) args.include_content = p.include_content;
			const content = await current.callTool("context", args, signal);
			return {
				content,
				details: { name: p.name ?? null, uid: p.uid ?? null, repo: resolved },
			};
		},
	};
}
