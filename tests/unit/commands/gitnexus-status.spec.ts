import { describe, expect, test } from "vitest";
import { AugmentCache } from "../../../src/augment-cache";
import { createGitNexusStatusCommand } from "../../../src/commands/gitnexus-status";
import type { McpContentItem } from "../../../src/mcp-client";
import { createFakeResolveRepo } from "../fakes/resolve-repo-fake";

type Notification = { message: string; level: string };

function createFakeCtx(cwd = "/repo") {
	const notifications: Notification[] = [];
	const ctx = {
		cwd,
		ui: {
			notify: (message: string, level: string) => {
				notifications.push({ message, level });
			},
		},
	};
	return { ctx, notifications };
}

function createFullDeps(
	overrides: Partial<Parameters<typeof createGitNexusStatusCommand>[0]> = {},
) {
	const cache = new AugmentCache();
	return {
		binaryPath: () => "/usr/bin/gitnexus" as string | null,
		client: () =>
			({ callTool: async () => [] as McpContentItem[], dead: false }) as {
				callTool: (...args: unknown[]) => Promise<McpContentItem[]>;
				dead: boolean;
			} | null,
		augmentEnabled: () => true,
		cache,
		resolveRepo: createFakeResolveRepo("/repo"),
		...overrides,
	};
}

describe("createGitNexusStatusCommand", () => {
	test("happy path — all sections present in notify", async () => {
		const deps = createFullDeps();
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		const msg = notifications[0].message;
		expect(msg).toContain("Binary:");
		expect(msg).toContain("/usr/bin/gitnexus");
		expect(msg).toContain("MCP client:");
		expect(msg).toContain("running");
		expect(msg).toContain("Current repo:");
		expect(msg).toContain("/repo");
		expect(msg).toContain("Augment hook:");
		expect(msg).toContain("on");
		expect(notifications[0].level).toBe("info");
	});

	test("binary not installed → formats 'not installed'", async () => {
		const deps = createFullDeps({ binaryPath: () => null });
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		expect(notifications[0].message).toContain("not installed");
	});

	test("client null → formats 'not started'", async () => {
		const deps = createFullDeps({ client: () => null });
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		expect(notifications[0].message).toContain("not started");
	});

	test("client dead → formats 'dead'", async () => {
		const deps = createFullDeps({
			client: () => ({ callTool: async () => [], dead: true }),
		});
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		expect(notifications[0].message).toContain("dead");
	});

	test("no indexed repo → formats 'no index'", async () => {
		const deps = createFullDeps({ resolveRepo: createFakeResolveRepo(null) });
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		expect(notifications[0].message).toContain("no index");
	});

	test("augment disabled → formats 'off'", async () => {
		const deps = createFullDeps({ augmentEnabled: () => false });
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		expect(notifications[0].message).toContain("off");
	});

	test("non-zero counters formatted with correct counts", async () => {
		const deps = createFullDeps();
		deps.cache.add("a.ts");
		deps.cache.add("b.ts");
		deps.cache.has("a.ts");
		deps.cache.recordSuccess();
		deps.cache.recordSuccess();
		deps.cache.recordSuccess();
		deps.cache.recordFailure();
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);
		const msg = notifications[0].message;
		expect(msg).toContain("3"); // successes
		expect(msg).toContain("1"); // failures
	});

	test("never throws — inject accessor that throws → still notifies error", async () => {
		const deps = createFullDeps({
			binaryPath: () => {
				throw new Error("accessor boom");
			},
		});
		const cmd = createGitNexusStatusCommand(deps);
		const { ctx, notifications } = createFakeCtx();
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await expect(cmd.handler("", ctx as any)).resolves.toBeUndefined();
		expect(notifications.some((n) => n.level === "error")).toBe(true);
	});
});
