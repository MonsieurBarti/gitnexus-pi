import { describe, expect, test } from "vitest";
import { McpClientError } from "../../../src/errors";
import { createGitNexusQueryTool } from "../../../src/tools/gitnexus-query";
import { FakeMcpClient } from "../fakes/mcp-client-fake";

const TOOL_CALL_ID = "tc-1";

describe("createGitNexusQueryTool", () => {
	test("has expected name and label", () => {
		const tool = createGitNexusQueryTool(() => null);
		expect(tool.name).toBe("tff-gitnexus_query");
		expect(tool.label).toBe("GitNexus Query");
	});

	test("execute passes query through to callTool and returns content", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "query" && args.query === "foo",
				result: [{ type: "text", text: "match" }],
			},
		]);
		const tool = createGitNexusQueryTool(() => client);
		const result = await tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, {});
		expect(client.calls).toEqual([{ name: "query", args: { query: "foo" } }]);
		expect(result.content).toEqual([{ type: "text", text: "match" }]);
		expect(result.details).toEqual({ query: "foo", repo: null });
	});

	test("execute includes repo and limit when provided", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "query" && args.query === "bar" && args.repo === "myrepo" && args.limit === 5,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusQueryTool(() => client);
		await tool.execute(
			TOOL_CALL_ID,
			{ query: "bar", repo: "myrepo", limit: 5 },
			undefined,
			undefined,
			{},
		);
		expect(client.calls[0].args).toEqual({ query: "bar", repo: "myrepo", limit: 5 });
	});

	test("execute throws install hint when client accessor returns null", async () => {
		const tool = createGitNexusQueryTool(() => null);
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, {}),
		).rejects.toThrow(/npm i -g gitnexus/);
	});

	test("execute re-throws McpClientError from underlying client", async () => {
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: new McpClientError("server exploded"),
			},
		]);
		const tool = createGitNexusQueryTool(() => client);
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, {}),
		).rejects.toBeInstanceOf(McpClientError);
	});

	test("execute propagates aborted signal to callTool", async () => {
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusQueryTool(() => client);
		const controller = new AbortController();
		controller.abort();
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, controller.signal, undefined, {}),
		).rejects.toThrow();
	});
});
