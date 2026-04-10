import { describe, expect, test } from "vitest";
import { MESSAGES, McpClientError } from "../../../src/errors";
import { createGitNexusQueryTool } from "../../../src/tools/gitnexus-query";
import { FakeMcpClient } from "../fakes/mcp-client-fake";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

const TOOL_CALL_ID = "tc-1";

describe("createGitNexusQueryTool", () => {
	test("has expected name and label", () => {
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => null, resolveRepo);
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
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		const result = await tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, {
			cwd: "/repo",
		});
		expect(client.calls).toEqual([{ name: "query", args: { query: "foo", repo: "/repo" } }]);
		expect(result.content).toEqual([{ type: "text", text: "match" }]);
		expect(result.details).toEqual({ query: "foo", repo: "/repo" });
	});

	test("execute includes repo and limit when provided", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "query" && args.query === "bar" && args.repo === "myrepo" && args.limit === 5,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		await tool.execute(
			TOOL_CALL_ID,
			{ query: "bar", repo: "myrepo", limit: 5 },
			undefined,
			undefined,
			{ cwd: "/repo" },
		);
		expect(client.calls[0].args).toEqual({ query: "bar", repo: "myrepo", limit: 5 });
	});

	test("execute throws install hint when client accessor returns null", async () => {
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => null, resolveRepo);
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, { cwd: "/repo" }),
		).rejects.toThrow(/npm i -g gitnexus/);
	});

	test("execute re-throws McpClientError from underlying client", async () => {
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: new McpClientError("server exploded"),
			},
		]);
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, { cwd: "/repo" }),
		).rejects.toBeInstanceOf(McpClientError);
	});

	test("execute propagates aborted signal to callTool", async () => {
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		const controller = new AbortController();
		controller.abort();
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, controller.signal, undefined, { cwd: "/repo" }),
		).rejects.toThrow();
	});

	test("task_context and goal passed through when set", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "query" &&
					args.query === "foo" &&
					args.task_context === "refactoring" &&
					args.goal === "find callers",
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		await tool.execute(
			TOOL_CALL_ID,
			{ query: "foo", task_context: "refactoring", goal: "find callers" },
			undefined,
			undefined,
			{ cwd: "/repo" },
		);
		expect(client.calls[0].args.task_context).toBe("refactoring");
		expect(client.calls[0].args.goal).toBe("find callers");
	});

	test("include_content forwarded when true", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "query" && args.include_content === true,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		await tool.execute(
			TOOL_CALL_ID,
			{ query: "foo", include_content: true },
			undefined,
			undefined,
			{ cwd: "/repo" },
		);
		expect(client.calls[0].args.include_content).toBe(true);
	});

	test("throws noIndexFound when resolveRepo returns null", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const resolveRepo = createFakeResolveRepo(null);
		const tool = createGitNexusQueryTool(() => client, resolveRepo);
		await expect(
			tool.execute(TOOL_CALL_ID, { query: "foo" }, undefined, undefined, { cwd: "/nowhere" }),
		).rejects.toThrow(MESSAGES.noIndexFound);
	});
});
