import type { McpContentItem } from "../../../src/mcp-client.ts";

export type FakeMcpClientScript = Array<{
	match: (name: string, args: Record<string, unknown>) => boolean;
	result: McpContentItem[] | Error;
}>;

/**
 * Hand-rolled minimal fake of `GitNexusMcpClient`. Only implements the
 * surface that tool/command/hook code depends on: `callTool` and `dead`.
 */
export class FakeMcpClient {
	public dead = false;
	public readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];

	constructor(private readonly script: FakeMcpClientScript = []) {}

	async callTool(
		name: string,
		args: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<McpContentItem[]> {
		this.calls.push({ name, args });
		if (signal?.aborted) {
			throw new Error("aborted");
		}
		const entry = this.script.find((e) => e.match(name, args));
		if (!entry) {
			throw new Error(`FakeMcpClient: no script entry for ${name} ${JSON.stringify(args)}`);
		}
		if (entry.result instanceof Error) {
			throw entry.result;
		}
		return entry.result;
	}
}
