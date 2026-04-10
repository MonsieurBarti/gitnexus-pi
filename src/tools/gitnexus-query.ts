import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors";
import type { ClientAccessor, ResolveRepo, ToolCtx, ToolDefinition } from "./types";

export function createGitNexusQueryTool(
	client: ClientAccessor,
	resolveRepo: ResolveRepo,
): ToolDefinition {
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
			task_context: Type.Optional(
				Type.String({
					description: "Describes the broader task context (e.g. 'refactoring', 'debugging')",
				}),
			),
			goal: Type.Optional(
				Type.String({
					description: "The specific goal for this query (e.g. 'find callers')",
				}),
			),
			include_content: Type.Optional(
				Type.Boolean({
					description: "When true, include file content in results",
				}),
			),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const p = params as {
				query: string;
				repo?: string;
				limit?: number;
				task_context?: string;
				goal?: string;
				include_content?: boolean;
			};

			const current = client();
			if (!current) {
				throw new Error(MESSAGES.clientNotAvailable);
			}

			const resolved = resolveRepo(ctx as ToolCtx, p.repo);
			if (resolved === null) {
				throw new Error(MESSAGES.noIndexFound);
			}

			const args: Record<string, unknown> = { query: p.query, repo: resolved };
			if (p.limit !== undefined) args.limit = p.limit;
			if (p.task_context !== undefined) args.task_context = p.task_context;
			if (p.goal !== undefined) args.goal = p.goal;
			if (p.include_content !== undefined) args.include_content = p.include_content;

			const content = await current.callTool("query", args, signal);
			return {
				content,
				details: { query: p.query, repo: resolved },
			};
		},
	};
}
