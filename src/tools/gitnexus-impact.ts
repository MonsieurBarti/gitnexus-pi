import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors";
import type { GitNexusMcpClient } from "../mcp-client";
import type { ToolDefinition } from "./gitnexus-query";
import { StringEnum } from "./typebox-utils";

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;
type ToolCtx = { cwd: string };
type ResolveRepo = (ctx: ToolCtx, override?: string) => string | null;

export function createGitNexusImpactTool(
	client: ClientAccessor,
	resolveRepo: ResolveRepo,
): ToolDefinition {
	return {
		name: "tff-gitnexus_impact",
		label: "GitNexus Impact",
		description:
			"Analyze blast radius of proposed changes to a symbol. Returns upstream callers or downstream callees with depth and risk indicators.",
		parameters: Type.Object({
			target: Type.String({ description: "Symbol name to analyze impact for" }),
			direction: StringEnum(["upstream", "downstream"], {
				description: "Direction: 'upstream' = who calls this, 'downstream' = what does this call",
			}),
			maxDepth: Type.Optional(
				Type.Number({
					description: "Max traversal depth (1-10, default 3)",
					minimum: 1,
					maximum: 10,
				}),
			),
			relationTypes: Type.Optional(
				Type.Array(Type.String(), {
					description: "Filter to specific relation types (e.g., 'calls', 'imports')",
				}),
			),
			includeTests: Type.Optional(
				Type.Boolean({ description: "Include test files in results (default false)" }),
			),
			minConfidence: Type.Optional(
				Type.Number({
					description: "Minimum confidence threshold (0-1)",
					minimum: 0,
					maximum: 1,
				}),
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
			const p = params as {
				target: string;
				direction: string;
				maxDepth?: number;
				relationTypes?: string[];
				includeTests?: boolean;
				minConfidence?: number;
				repo?: string;
			};
			const resolved = resolveRepo(ctx as ToolCtx, p.repo);
			if (resolved === null) {
				throw new Error(MESSAGES.noIndexFound);
			}
			const args: Record<string, unknown> = {
				target: p.target,
				direction: p.direction,
				repo: resolved,
			};
			if (p.maxDepth !== undefined) args.maxDepth = p.maxDepth;
			if (p.relationTypes !== undefined) args.relationTypes = p.relationTypes;
			if (p.includeTests !== undefined) args.includeTests = p.includeTests;
			if (p.minConfidence !== undefined) args.minConfidence = p.minConfidence;
			const content = await current.callTool("impact", args, signal);
			return {
				content,
				details: { target: p.target, direction: p.direction, repo: resolved },
			};
		},
	};
}
