import { describe, expect, test } from "vitest";
import { MESSAGES, McpClientError } from "../../../src/errors";
import { createGitNexusCypherTool } from "../../../src/tools/gitnexus-cypher";
import { FakeMcpClient } from "../fakes/mcp-client-fake";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

const TOOL_CALL_ID = "tc-1";
const CTX = { cwd: "/repo" };

describe("createGitNexusCypherTool", () => {
	test("has expected name and label", () => {
		const tool = createGitNexusCypherTool(() => null, createFakeResolveRepo("/repo"));
		expect(tool.name).toBe("tff-gitnexus_cypher");
		expect(tool.label).toBe("GitNexus Cypher");
	});

	test("happy path — query forwarded with resolved repo", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "cypher" && args.query === "MATCH (n) RETURN n" && args.repo === "/repo",
				result: [{ type: "text", text: "nodes: 42" }],
			},
		]);
		const tool = createGitNexusCypherTool(() => client, createFakeResolveRepo("/repo"));
		const result = await tool.execute(
			TOOL_CALL_ID,
			{ query: "MATCH (n) RETURN n" },
			undefined,
			undefined,
			CTX,
		);
		expect(result.content).toEqual([{ type: "text", text: "nodes: 42" }]);
	});

	test("throws noIndexFound when resolver returns null", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const tool = createGitNexusCypherTool(() => client, createFakeResolveRepo(null));
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "MATCH (n) RETURN n" }, undefined, undefined, CTX),
		).rejects.toThrow(MESSAGES.noIndexFound);
	});

	test("throws clientNotAvailable when client is null", async () => {
		const tool = createGitNexusCypherTool(() => null, createFakeResolveRepo("/repo"));
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "MATCH (n) RETURN n" }, undefined, undefined, CTX),
		).rejects.toThrow(MESSAGES.clientNotAvailable);
	});

	test("re-throws upstream errors", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: new McpClientError("exploded") },
		]);
		const tool = createGitNexusCypherTool(() => client, createFakeResolveRepo("/repo"));
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "MATCH (n) RETURN n" }, undefined, undefined, CTX),
		).rejects.toBeInstanceOf(McpClientError);
	});
});
