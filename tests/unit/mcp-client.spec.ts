import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { McpClientError } from "../../src/errors";
import { GitNexusMcpClient, type SpawnFn } from "../../src/mcp-client";

type FakeChild = EventEmitter & {
	stdin: PassThrough;
	stdout: PassThrough;
	stderr: PassThrough | null;
	pid: number;
	kill: (signal?: NodeJS.Signals) => boolean;
	killed: boolean;
};

function createFakeChild(): FakeChild {
	const emitter = new EventEmitter() as FakeChild;
	emitter.stdin = new PassThrough();
	emitter.stdout = new PassThrough();
	emitter.stderr = null;
	emitter.pid = 12345;
	emitter.killed = false;
	emitter.kill = (signal?: NodeJS.Signals) => {
		emitter.killed = true;
		// Simulate process exit on kill.
		setImmediate(() => {
			emitter.emit("exit", null, signal ?? "SIGTERM");
		});
		return true;
	};
	return emitter;
}

function createSpawnFake() {
	const state = {
		child: null as FakeChild | null,
		lastArgs: null as { cmd: string; args: string[]; cwd: string } | null,
	};
	const spawn: SpawnFn = (cmd, args, opts) => {
		state.lastArgs = { cmd, args, cwd: (opts?.cwd as string) ?? "" };
		state.child = createFakeChild();
		return state.child as unknown as ReturnType<SpawnFn>;
	};
	return {
		spawn,
		get child(): FakeChild {
			if (!state.child) throw new Error("child not yet spawned");
			return state.child;
		},
		get lastArgs() {
			return state.lastArgs;
		},
	};
}

/** Push a JSON-RPC message onto the fake child's stdout. */
function pushMessage(child: FakeChild, msg: unknown): void {
	child.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function flush(): Promise<void> {
	await new Promise((resolve) => setImmediate(resolve));
	await new Promise((resolve) => setImmediate(resolve));
}

describe("GitNexusMcpClient", () => {
	let fake: ReturnType<typeof createSpawnFake>;
	let client: GitNexusMcpClient;

	beforeEach(() => {
		fake = createSpawnFake();
		client = new GitNexusMcpClient("/bin/gitnexus", "/repo", fake.spawn);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("start() spawns child and completes initialize handshake", async () => {
		const startPromise = client.start();
		await flush();
		expect(fake.lastArgs).toEqual({
			cmd: "/bin/gitnexus",
			args: ["mcp"],
			cwd: "/repo",
		});
		// Server responds to initialize.
		pushMessage(fake.child, {
			jsonrpc: "2.0",
			id: 1,
			result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: {} },
		});
		await startPromise;
		// Verify initialized notification was sent.
		const sent = fake.child.stdin.read()?.toString() ?? "";
		expect(sent).toContain('"method":"initialize"');
		expect(sent).toContain('"notifications/initialized"');
	});

	test("start() rejects when child exits before handshake completes", async () => {
		const startPromise = client.start();
		await flush();
		fake.child.emit("exit", 1, null);
		await expect(startPromise).rejects.toBeInstanceOf(McpClientError);
	});

	test("callTool sends tools/call and resolves matching response", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2024-11-05" } });
		await startPromise;

		const callPromise = client.callTool("query", { query: "foo" });
		await flush();
		pushMessage(fake.child, {
			jsonrpc: "2.0",
			id: 2,
			result: { content: [{ type: "text", text: "result" }] },
		});
		const content = await callPromise;
		expect(content).toEqual([{ type: "text", text: "result" }]);
	});

	test("callTool correlates out-of-order responses by id", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;

		const callA = client.callTool("query", { query: "a" });
		const callB = client.callTool("query", { query: "b" });
		await flush();
		// Respond to B first, then A.
		pushMessage(fake.child, {
			jsonrpc: "2.0",
			id: 3,
			result: { content: [{ type: "text", text: "B" }] },
		});
		pushMessage(fake.child, {
			jsonrpc: "2.0",
			id: 2,
			result: { content: [{ type: "text", text: "A" }] },
		});
		const [contentA, contentB] = await Promise.all([callA, callB]);
		expect(contentA[0]).toMatchObject({ text: "A" });
		expect(contentB[0]).toMatchObject({ text: "B" });
	});

	test("callTool ignores malformed JSON lines but processes subsequent ones", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;

		const callPromise = client.callTool("query", { query: "foo" });
		await flush();
		fake.child.stdout.write("not-json-garbage\n");
		pushMessage(fake.child, {
			jsonrpc: "2.0",
			id: 2,
			result: { content: [{ type: "text", text: "ok" }] },
		});
		const content = await callPromise;
		expect(content[0]).toMatchObject({ text: "ok" });
	});

	test("callTool rejects when child dies mid-call", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;

		const callPromise = client.callTool("query", { query: "foo" });
		await flush();
		fake.child.emit("exit", 1, null);
		await expect(callPromise).rejects.toBeInstanceOf(McpClientError);
		expect(client.dead).toBe(true);
	});

	test("callTool throws immediately after client is dead", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;
		fake.child.emit("exit", 1, null);
		await flush();
		await expect(client.callTool("query", {})).rejects.toBeInstanceOf(McpClientError);
	});

	test("callTool honors AbortSignal", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;

		const controller = new AbortController();
		const callPromise = client.callTool("query", { query: "foo" }, controller.signal);
		controller.abort();
		await expect(callPromise).rejects.toThrow();
	});

	test("callTool rejects JSON-RPC error responses as McpClientError", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;

		const callPromise = client.callTool("query", { query: "foo" });
		await flush();
		pushMessage(fake.child, {
			jsonrpc: "2.0",
			id: 2,
			error: { code: -32000, message: "boom" },
		});
		await expect(callPromise).rejects.toBeInstanceOf(McpClientError);
	});

	test("close sends SIGTERM and resolves when child exits", async () => {
		const startPromise = client.start();
		await flush();
		pushMessage(fake.child, { jsonrpc: "2.0", id: 1, result: {} });
		await startPromise;

		await client.close();
		expect(fake.child.killed).toBe(true);
	});
});
