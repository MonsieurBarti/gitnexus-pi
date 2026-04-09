import { describe, expect, test } from "vitest";
import { AugmentCache } from "../../../src/augment-cache";
import { createAugmentGrepHook } from "../../../src/hooks/augment-grep";
import { FakeMcpClient } from "../fakes/mcp-client-fake";

function grepEvent(text: string, isError = false) {
	return {
		name: "grep",
		isError,
		content: [{ type: "text", text }],
	};
}

describe("createAugmentGrepHook", () => {
	test("returns undefined for non-grep events", async () => {
		const hook = createAugmentGrepHook(() => new FakeMcpClient(), new AugmentCache());
		const result = await hook({ name: "read", isError: false, content: [] });
		expect(result).toBeUndefined();
	});

	test("returns undefined when grep result is an error", async () => {
		const hook = createAugmentGrepHook(() => new FakeMcpClient(), new AugmentCache());
		const result = await hook(grepEvent("foo.ts:1:match", true));
		expect(result).toBeUndefined();
	});

	test("returns undefined when client is null", async () => {
		const hook = createAugmentGrepHook(() => null, new AugmentCache());
		const result = await hook(grepEvent("foo.ts:1:match"));
		expect(result).toBeUndefined();
	});

	test("returns undefined when grep produced no parseable file paths", async () => {
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient([{ match: () => true, result: [] }]),
			new AugmentCache(),
		);
		const result = await hook(grepEvent("no paths here just words"));
		expect(result).toBeUndefined();
	});

	test("returns undefined when all paths are already cached", async () => {
		const cache = new AugmentCache();
		cache.add("foo.ts");
		const hook = createAugmentGrepHook(() => new FakeMcpClient(), cache);
		const result = await hook(grepEvent("foo.ts:1:match"));
		expect(result).toBeUndefined();
	});

	test("enriches grep result with query content for first path", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{
				match: (name, args) => name === "query" && args.query === "foo.ts",
				result: [{ type: "text", text: "foo.ts: 3 callers in cluster #4" }],
			},
		]);
		const hook = createAugmentGrepHook(() => client, cache);
		const event = grepEvent("foo.ts:1:match");
		const result = await hook(event);
		expect(result?.content).toHaveLength(2);
		expect(result?.content?.[0]).toEqual(event.content[0]);
		expect((result?.content?.[1] as { text: string }).text).toContain("GitNexus context");
		expect((result?.content?.[1] as { text: string }).text).toContain("3 callers in cluster");
		expect(cache.has("foo.ts")).toBe(true);
	});

	test("limits to 3 unique paths", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{
				match: (name) => name === "query",
				result: [{ type: "text", text: "hit" }],
			},
		]);
		const hook = createAugmentGrepHook(() => client, cache);
		const event = grepEvent(
			["a.ts:1:match", "b.ts:2:match", "c.ts:3:match", "d.ts:4:match", "e.ts:5:match"].join("\n"),
		);
		await hook(event);
		// Only first 3 paths should have been queried.
		expect(client.calls.length).toBe(3);
		expect(cache.has("a.ts")).toBe(true);
		expect(cache.has("b.ts")).toBe(true);
		expect(cache.has("c.ts")).toBe(true);
		expect(cache.has("d.ts")).toBe(false);
	});

	test("partial failure: successful paths enriched, failed paths uncached", async () => {
		const cache = new AugmentCache();
		let call = 0;
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		// Override callTool to fail on the second call.
		const original = client.callTool.bind(client);
		client.callTool = async (name, args, signal) => {
			call++;
			if (call === 2) throw new Error("boom");
			return original(name, args, signal);
		};

		const hook = createAugmentGrepHook(() => client, cache);
		const event = grepEvent("a.ts:1:match\nb.ts:2:match\nc.ts:3:match");
		const result = await hook(event);
		// Aggregated content still includes the two successes.
		expect(result?.content).toHaveLength(2);
		expect(cache.has("a.ts")).toBe(true);
		expect(cache.has("b.ts")).toBe(false); // failed — not cached
		expect(cache.has("c.ts")).toBe(true);
	});

	test("returns undefined when every call fails", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: new Error("all dead"),
			},
		]);
		const hook = createAugmentGrepHook(() => client, cache);
		const result = await hook(grepEvent("a.ts:1:match\nb.ts:2:match"));
		expect(result).toBeUndefined();
		expect(cache.has("a.ts")).toBe(false);
		expect(cache.has("b.ts")).toBe(false);
	});

	test("returns undefined when aggregate content is empty", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: [{ type: "text", text: "" }], // present but empty
			},
		]);
		const hook = createAugmentGrepHook(() => client, cache);
		const result = await hook(grepEvent("a.ts:1:match"));
		expect(result).toBeUndefined();
	});
});
