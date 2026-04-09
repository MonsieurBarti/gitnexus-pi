import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors.ts";
import type { GitNexusMcpClient, McpContentItem } from "../mcp-client.ts";

/**
 * Minimal structural type matching the PI extension tool shape that we consume.
 * Using a local type so tests do not need to import from
 * `@mariozechner/pi-coding-agent` — consumers of this package will receive
 * the real `ToolDefinition` through `pi.registerTool`.
 */
export type ToolDefinition = {
	name: string;
	label: string;
	description: string;
	parameters: ReturnType<typeof Type.Object>;
	execute: (
		toolCallId: string,
		params: { query: string; repo?: string; limit?: number },
		signal: AbortSignal | undefined,
		onUpdate: unknown,
		ctx: unknown,
	) => Promise<{ content: McpContentItem[]; details: Record<string, unknown> }>;
};

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;

export function createGitNexusQueryTool(client: ClientAccessor): ToolDefinition {
	return {
		name: "tff-gitnexus_query",
		label: "GitNexus Query",
		description:
			"Search the GitNexus code knowledge graph for symbols, files, or concepts. Returns structural context (file, kind, cluster, callers) for matches.",
		parameters: Type.Object({
			query: Type.String({
				description:
					"Symbol name, file path, or natural-language description of what you're looking for",
			}),
			repo: Type.Optional(
				Type.String({
					description: "Repo name or absolute path. Omit to auto-detect from cwd.",
				}),
			),
			limit: Type.Optional(
				Type.Number({
					description: "Max results (default 10)",
					minimum: 1,
					maximum: 50,
				}),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			const current = client();
			if (!current) {
				throw new Error(MESSAGES.clientNotAvailable);
			}
			const args: Record<string, unknown> = { query: params.query };
			if (params.repo !== undefined) args.repo = params.repo;
			if (params.limit !== undefined) args.limit = params.limit;
			const content = await current.callTool("query", args, signal);
			return {
				content,
				details: { query: params.query, repo: params.repo ?? null },
			};
		},
	};
}
