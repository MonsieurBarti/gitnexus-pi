import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors";
import type { GitNexusMcpClient, McpContentItem } from "../mcp-client";
import type { ToolDefinition } from "./gitnexus-query";

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;
type ToolCtx = { cwd: string };
type ResolveRepo = (ctx: ToolCtx, override?: string) => string | null;

export function createGitNexusCypherTool(
	client: ClientAccessor,
	resolveRepo: ResolveRepo,
): ToolDefinition {
	return {
		name: "tff-gitnexus_cypher",
		label: "GitNexus Cypher",
		description:
			"Execute a raw Cypher query against the GitNexus knowledge graph. Read gitnexus://repo/{name}/schema first to understand the schema.",
		parameters: Type.Object({
			query: Type.String({ description: "Cypher query to execute" }),
			repo: Type.Optional(
				Type.String({ description: "Repo name or absolute path. Omit to auto-detect from cwd." }),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const current = client();
			if (!current) {
				throw new Error(MESSAGES.clientNotAvailable);
			}
			const p = params as { query: string; repo?: string };
			const resolved = resolveRepo(ctx as ToolCtx, p.repo);
			if (resolved === null) {
				throw new Error(MESSAGES.noIndexFound);
			}
			const content = await current.callTool("cypher", { query: p.query, repo: resolved }, signal);
			return {
				content,
				details: { query: p.query, repo: resolved },
			};
		},
	};
}
