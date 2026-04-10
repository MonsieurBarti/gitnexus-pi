import { describe, expect, test, vi } from "vitest";
import { AugmentCache } from "../../../src/augment-cache";
import { createAugmentGrepHook } from "../../../src/hooks/augment-grep";
import { FakeMcpClient } from "../fakes/mcp-client-fake";

function grepEvent(text: string, isError = false) {
	return {
		toolName: "grep",
		isError,
		content: [{ type: "text", text }],
		input: {},
	};
}

function findEvent(text: string, isError = false) {
	return {
		toolName: "find",
		isError,
		content: [{ type: "text", text }],
		input: {},
	};
}

function readEvent(path: string | undefined, isError = false) {
	return {
		toolName: "read",
		isError,
		content: [{ type: "text", text: "file content" }],
		input: path !== undefined ? { path } : {},
	};
}

describe("createAugmentGrepHook", () => {
	test("returns undefined for non-grep events", async () => {
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient(),
			new AugmentCache(),
			() => true,
		);
		const result = await hook({ toolName: "write", isError: false, content: [], input: {} });
		expect(result).toBeUndefined();
	});

	test("returns undefined when grep result is an error", async () => {
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient(),
			new AugmentCache(),
			() => true,
		);
		const result = await hook(grepEvent("foo.ts:1:match", true));
		expect(result).toBeUndefined();
	});

	test("returns undefined when client is null", async () => {
		const hook = createAugmentGrepHook(
			() => null,
			new AugmentCache(),
			() => true,
		);
		const result = await hook(grepEvent("foo.ts:1:match"));
		expect(result).toBeUndefined();
	});

	test("returns undefined when grep produced no parseable file paths", async () => {
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient([{ match: () => true, result: [] }]),
			new AugmentCache(),
			() => true,
		);
		const result = await hook(grepEvent("no paths here just words"));
		expect(result).toBeUndefined();
	});

	test("returns undefined when all paths are already cached", async () => {
		const cache = new AugmentCache();
		cache.add("foo.ts");
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient(),
			cache,
			() => true,
		);
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
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
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
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
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

		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
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
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
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
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
		const result = await hook(grepEvent("a.ts:1:match"));
		expect(result).toBeUndefined();
	});

	test("find event with multi-line path content is enriched", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{
				match: (name) => name === "query",
				result: [{ type: "text", text: "context info" }],
			},
		]);
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
		const result = await hook(findEvent("/src/foo.ts\n/src/bar.ts"));
		expect(result?.content).toHaveLength(2);
		expect((result?.content?.[1] as { text: string }).text).toContain("GitNexus context");
	});

	test("find event with zero paths returns undefined", async () => {
		const cache = new AugmentCache();
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient(),
			cache,
			() => true,
		);
		const result = await hook(findEvent(""));
		expect(result).toBeUndefined();
	});

	test("read event with event.input.path is enriched", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{
				match: (name) => name === "query",
				result: [{ type: "text", text: "context info" }],
			},
		]);
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
		const result = await hook(readEvent("/src/foo.ts"));
		expect(result?.content).toHaveLength(2);
		expect(cache.has("/src/foo.ts")).toBe(true);
	});

	test("read event with missing input.path returns undefined", async () => {
		const cache = new AugmentCache();
		const hook = createAugmentGrepHook(
			() => new FakeMcpClient(),
			cache,
			() => true,
		);
		const result = await hook(readEvent(undefined));
		expect(result).toBeUndefined();
	});

	test("augmentEnabled returns false → returns undefined", async () => {
		const cache = new AugmentCache();
		const client = new FakeMcpClient([
			{ match: () => true, result: [{ type: "text", text: "ok" }] },
		]);
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => false,
		);
		const result = await hook(grepEvent("foo.ts:1:match"));
		expect(result).toBeUndefined();
	});

	test("recordSuccess and recordFailure bumped on correct paths", async () => {
		const cache = new AugmentCache();
		let callCount = 0;
		const client = new FakeMcpClient([
			{
				match: () => true,
				result: [{ type: "text", text: "ok" }],
			},
		]);
		const original = client.callTool.bind(client);
		client.callTool = async (name, args, signal) => {
			callCount++;
			if (callCount === 2) throw new Error("boom");
			return original(name, args, signal);
		};
		const hook = createAugmentGrepHook(
			() => client,
			cache,
			() => true,
		);
		await hook(grepEvent("a.ts:1:match\nb.ts:2:match\nc.ts:3:match"));
		expect(cache.successes).toBe(2);
		expect(cache.failures).toBe(1);
	});

	test("GITNEXUS_PI_DEBUG=1 + failure → console.error called", async () => {
		const originalDebug = process.env.GITNEXUS_PI_DEBUG;
		process.env.GITNEXUS_PI_DEBUG = "1";
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const cache = new AugmentCache();
			const client = new FakeMcpClient([
				{ match: () => true, result: new Error("debug-test-error") },
			]);
			const hook = createAugmentGrepHook(
				() => client,
				cache,
				() => true,
			);
			await hook(grepEvent("a.ts:1:match"));
			expect(errorSpy).toHaveBeenCalled();
		} finally {
			process.env.GITNEXUS_PI_DEBUG = originalDebug;
			errorSpy.mockRestore();
		}
	});
});
