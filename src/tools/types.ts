import type { Type } from "@sinclair/typebox";
import type { GitNexusMcpClient, McpContentItem } from "../mcp-client";

/**
 * Minimal structural type matching the PI extension tool shape that we consume.
 * Using a local type so tests do not need to import from
 * `@mariozechner/pi-coding-agent` — consumers of this package will receive
 * the real `ToolDefinition` through `pi.registerTool`.
 */
export type ToolDefinition = {
	name: string;
	readOnly?: boolean;
	label: string;
	description: string;
	parameters: ReturnType<typeof Type.Object>;
	execute: (
		toolCallId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		onUpdate: unknown,
		ctx: unknown,
	) => Promise<{ content: McpContentItem[]; details: Record<string, unknown> }>;
};

export type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;
export type ToolCtx = { cwd: string };
export type ResolveRepo = (ctx: ToolCtx, override?: string) => string | null;
