import { describe, expect, test } from "vitest";
import { MESSAGES, McpClientError } from "../../../src/errors";
import { createGitNexusDetectChangesTool } from "../../../src/tools/gitnexus-detect-changes";
import { FakeMcpClient } from "../fakes/mcp-client-fake";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

const TOOL_CALL_ID = "tc-1";
const CTX = { cwd: "/repo" };

describe("createGitNexusDetectChangesTool", () => {
	test("has expected name and label", () => {
		const tool = createGitNexusDetectChangesTool(() => null, createFakeResolveRepo("/repo"));
		expect(tool.name).toBe("tff-gitnexus_detect_changes");
		expect(tool.label).toBe("GitNexus Detect Changes");
	});

	test("happy path with default scope (no params)", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "detect_changes" && args.repo === "/repo",
				result: [{ type: "text", text: "2 processes affected" }],
			},
		]);
		const tool = createGitNexusDetectChangesTool(() => client, createFakeResolveRepo("/repo"));
		const result = await tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX);
		expect(result.content).toEqual([{ type: "text", text: "2 processes affected" }]);
	});

	test("explicit scope and base_ref forwarded", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "detect_changes" && args.scope === "compare" && args.base_ref === "main",
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusDetectChangesTool(() => client, createFakeResolveRepo("/repo"));
		await tool.execute(
			TOOL_CALL_ID,
			{ scope: "compare", base_ref: "main" },
			undefined,
			undefined,
			CTX,
		);
		expect(client.calls[0].args.scope).toBe("compare");
		expect(client.calls[0].args.base_ref).toBe("main");
	});

	test("each scope enum value accepted", async () => {
		for (const scope of ["unstaged", "staged", "all", "compare"]) {
			const client = new FakeMcpClient([
				{
					match: (name, args) => name === "detect_changes" && args.scope === scope,
					result: [{ type: "text", text: "ok" }],
				},
			]);
			const tool = createGitNexusDetectChangesTool(() => client, createFakeResolveRepo("/repo"));
			await tool.execute(TOOL_CALL_ID, { scope }, undefined, undefined, CTX);
			expect(client.calls[0].args.scope).toBe(scope);
		}
	});

	test("throws noIndexFound when resolver returns null", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const tool = createGitNexusDetectChangesTool(() => client, createFakeResolveRepo(null));
		await expect(tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX)).rejects.toThrow(
			MESSAGES.noIndexFound,
		);
	});

	test("throws clientNotAvailable when client is null", async () => {
		const tool = createGitNexusDetectChangesTool(() => null, createFakeResolveRepo("/repo"));
		await expect(tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX)).rejects.toThrow(
			MESSAGES.clientNotAvailable,
		);
	});

	test("re-throws upstream errors", async () => {
		const client = new FakeMcpClient([{ match: () => true, result: new McpClientError("boom") }]);
		const tool = createGitNexusDetectChangesTool(() => client, createFakeResolveRepo("/repo"));
		await expect(tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX)).rejects.toBeInstanceOf(
			McpClientError,
		);
	});
});
