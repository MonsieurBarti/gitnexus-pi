import { describe, expect, test } from "vitest";
import { MESSAGES, McpClientError } from "../../../src/errors";
import { createGitNexusImpactTool } from "../../../src/tools/gitnexus-impact";
import { FakeMcpClient } from "../fakes/mcp-client-fake";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

const TOOL_CALL_ID = "tc-1";
const CTX = { cwd: "/repo" };

describe("createGitNexusImpactTool", () => {
	test("has expected name and label", () => {
		const tool = createGitNexusImpactTool(() => null, createFakeResolveRepo("/repo"));
		expect(tool.name).toBe("tff-gitnexus_impact");
		expect(tool.label).toBe("GitNexus Impact");
	});

	test("happy path with required target and direction", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "impact" && args.target === "fn" && args.direction === "upstream",
				result: [{ type: "text", text: "3 callers" }],
			},
		]);
		const tool = createGitNexusImpactTool(() => client, createFakeResolveRepo("/repo"));
		const result = await tool.execute(
			TOOL_CALL_ID,
			{ target: "fn", direction: "upstream" },
			undefined,
			undefined,
			CTX,
		);
		expect(result.content).toEqual([{ type: "text", text: "3 callers" }]);
		expect(client.calls[0].args.repo).toBe("/repo");
	});

	test("optional params forwarded when set", async () => {
		const client = new FakeMcpClient([
			{
				match: (name, args) =>
					name === "impact" &&
					args.maxDepth === 5 &&
					args.includeTests === true &&
					args.minConfidence === 0.8 &&
					Array.isArray(args.relationTypes),
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusImpactTool(() => client, createFakeResolveRepo("/repo"));
		await tool.execute(
			TOOL_CALL_ID,
			{
				target: "fn",
				direction: "downstream",
				maxDepth: 5,
				relationTypes: ["calls", "imports"],
				includeTests: true,
				minConfidence: 0.8,
			},
			undefined,
			undefined,
			CTX,
		);
		const args = client.calls[0].args;
		expect(args.maxDepth).toBe(5);
		expect(args.relationTypes).toEqual(["calls", "imports"]);
		expect(args.includeTests).toBe(true);
		expect(args.minConfidence).toBe(0.8);
	});

	test("throws noIndexFound when resolver returns null", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const tool = createGitNexusImpactTool(() => client, createFakeResolveRepo(null));
		await expect(
			tool.execute(
				TOOL_CALL_ID,
				{ target: "fn", direction: "upstream" },
				undefined,
				undefined,
				CTX,
			),
		).rejects.toThrow(MESSAGES.noIndexFound);
	});

	test("throws clientNotAvailable when client is null", async () => {
		const tool = createGitNexusImpactTool(() => null, createFakeResolveRepo("/repo"));
		await expect(
			tool.execute(
				TOOL_CALL_ID,
				{ target: "fn", direction: "upstream" },
				undefined,
				undefined,
				CTX,
			),
		).rejects.toThrow(MESSAGES.clientNotAvailable);
	});

	test("re-throws upstream errors", async () => {
		const client = new FakeMcpClient([
			{ match: () => true, result: new McpClientError("exploded") },
		]);
		const tool = createGitNexusImpactTool(() => client, createFakeResolveRepo("/repo"));
		await expect(
			tool.execute(
				TOOL_CALL_ID,
				{ target: "fn", direction: "upstream" },
				undefined,
				undefined,
				CTX,
			),
		).rejects.toBeInstanceOf(McpClientError);
	});
});
