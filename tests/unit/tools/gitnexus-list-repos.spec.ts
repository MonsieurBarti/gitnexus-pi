import { describe, expect, test } from "vitest";
import { MESSAGES } from "../../../src/errors";
import { createGitNexusListReposTool } from "../../../src/tools/gitnexus-list-repos";
import { FakeMcpClient } from "../fakes/mcp-client-fake";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

const TOOL_CALL_ID = "tc-1";
const CTX = { cwd: "/repo" };

describe("createGitNexusListReposTool", () => {
	test("has expected name and label", () => {
		const tool = createGitNexusListReposTool(() => null);
		expect(tool.name).toBe("tff-gitnexus_list_repos");
		expect(tool.label).toBe("GitNexus List Repos");
	});

	test("happy path — no params, calls list_repos", async () => {
		const client = new FakeMcpClient([
			{
				match: (name) => name === "list_repos",
				result: [{ type: "text", text: "repo1, repo2" }],
			},
		]);
		const tool = createGitNexusListReposTool(() => client);
		const result = await tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX);
		expect(result.content).toEqual([{ type: "text", text: "repo1, repo2" }]);
		expect(client.calls[0]).toEqual({ name: "list_repos", args: {} });
	});

	test("does NOT call resolveRepoRoot", async () => {
		const resolveRepo = createFakeResolveRepo("/repo");
		const client = new FakeMcpClient([
			{
				match: (name) => name === "list_repos",
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const tool = createGitNexusListReposTool(() => client);
		await tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX);
		expect(resolveRepo.calls).toHaveLength(0);
	});

	test("throws clientNotAvailable when client is null", async () => {
		const tool = createGitNexusListReposTool(() => null);
		await expect(tool.execute(TOOL_CALL_ID, {}, undefined, undefined, CTX)).rejects.toThrow(
			MESSAGES.clientNotAvailable,
		);
	});
});
