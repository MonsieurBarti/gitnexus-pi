import { describe, expect, test } from "vitest";
import { MESSAGES, McpClientError } from "../../../src/errors";
import { createGitNexusContextTool } from "../../../src/tools/gitnexus-context";
import { FakeMcpClient } from "../fakes/mcp-client-fake";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

const TOOL_CALL_ID = "tc-1";
const CTX = { cwd: "/repo" };

describe("createGitNexusContextTool", () => {
	test("has expected name and label", () => {
		const tool = createGitNexusContextTool(() => null, createFakeResolveRepo("/repo"));
		expect(tool.name).toBe("tff-gitnexus_context");
		expect(tool.label).toBe("GitNexus Context");
	});

	test("happy path with name only", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "context" && args.name === "MyClass",
				result: [{ type: "text", text: "callers: 3" }],
			},
		]);
		const resolveRepo = createFakeResolveRepo("/repo");
		const tool = createGitNexusContextTool(() => client, resolveRepo);
		const result = await tool.execute(TOOL_CALL_ID, { name: "MyClass" }, undefined, undefined, CTX);
		expect(result.content).toEqual([{ type: "text", text: "callers: 3" }]);
		expect(client.calls[0].args.repo).toBe("/repo");
	});

	test("happy path with uid only", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "context" && args.uid === "abc-123",
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusContextTool(() => client, createFakeResolveRepo("/repo"));
		await tool.execute(TOOL_CALL_ID, { uid: "abc-123" }, undefined, undefined, CTX);
		expect(client.calls[0].args.uid).toBe("abc-123");
	});

	test("both name and file_path forwarded", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "context" && args.name === "fn" && args.file_path === "/a.ts",
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusContextTool(() => client, createFakeResolveRepo("/repo"));
		await tool.execute(TOOL_CALL_ID, { name: "fn", file_path: "/a.ts" }, undefined, undefined, CTX);
		expect(client.calls[0].args.file_path).toBe("/a.ts");
	});

	test("include_content forwarded when true", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "context" && args.include_content === true,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusContextTool(() => client, createFakeResolveRepo("/repo"));
		await tool.execute(
			TOOL_CALL_ID,
			{ name: "fn", include_content: true },
			undefined,
			undefined,
			CTX,
		);
		expect(client.calls[0].args.include_content).toBe(true);
	});

	test("throws when neither name nor uid provided", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const tool = createGitNexusContextTool(() => client, createFakeResolveRepo("/repo"));
		await expect(tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX)).rejects.toThrow(
			"requires either 'name' or 'uid'",
		);
	});

	test("throws noIndexFound when resolver returns null", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const tool = createGitNexusContextTool(() => client, createFakeResolveRepo(null));
		await expect(
			tool.execute(TOOL_CALL_ID, { name: "fn" }, undefined, undefined, CTX),
		).rejects.toThrow(MESSAGES.noIndexFound);
	});

	test("re-throws McpClientError from client", async () => {
		const client = new FakeMcpClient([{ match: () => true, result: new McpClientError("boom") }]);
		const tool = createGitNexusContextTool(() => client, createFakeResolveRepo("/repo"));
		await expect(
			tool.execute(TOOL_CALL_ID, { name: "fn" }, undefined, undefined, CTX),
		).rejects.toBeInstanceOf(McpClientError);
	});
});
