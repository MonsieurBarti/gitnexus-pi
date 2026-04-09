import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { PiExec } from "../../../src/binary-resolver";
import { createGitNexusIndexCommand } from "../../../src/commands/gitnexus-index";
import { MESSAGES } from "../../../src/errors";
import { createFakePiExec } from "../fakes/pi-exec-fake";

type Notification = { message: string; level: string };

function createFakeCtx(cwd: string) {
	const notifications: Notification[] = [];
	const ctx = {
		cwd,
		signal: new AbortController().signal,
		ui: {
			notify: (message: string, level: string) => {
				notifications.push({ message, level });
			},
		},
	};
	// Cast to the command ctx shape at the call site; tests don't need full types.
	return { ctx, notifications };
}

describe("createGitNexusIndexCommand", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "gitnexus-idx-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	test("creates .gitignore then runs gitnexus analyze on success", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd, args) => args[0] === "analyze",
				result: { stdout: "indexed 123 symbols", stderr: "", code: 0 },
			},
		]);
		const cmd = createGitNexusIndexCommand(exec, () => "/bin/gitnexus");
		const { ctx, notifications } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);

		expect(readFileSync(join(repo, ".gitignore"), "utf-8")).toBe(".gitnexus/\n");
		expect(notifications[0].message).toBe(MESSAGES.gitignoreCreated);
		expect(exec.calls[0]).toEqual({ cmd: "/bin/gitnexus", args: ["analyze"] });
		expect(notifications.at(-1)?.message).toBe(MESSAGES.indexReady(repo));
	});

	test("silent on gitignore when already present", async () => {
		writeFileSync(join(repo, ".gitignore"), ".gitnexus/\n");
		const exec = createFakePiExec([
			{
				match: () => true,
				result: { stdout: "", stderr: "", code: 0 },
			},
		]);
		const cmd = createGitNexusIndexCommand(exec, () => "/bin/gitnexus");
		const { ctx, notifications } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);

		expect(notifications.find((n) => n.message.includes(".gitignore"))).toBeUndefined();
		expect(notifications.at(-1)?.message).toBe(MESSAGES.indexReady(repo));
	});

	test("notifies error and skips analyze when binary missing", async () => {
		const exec = createFakePiExec([]);
		const cmd = createGitNexusIndexCommand(exec, () => null);
		const { ctx, notifications } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);

		expect(notifications.some((n) => n.message === MESSAGES.binaryNotFoundForCommand)).toBe(true);
		expect(exec.calls).toHaveLength(0);
	});

	test("notifies with stderr tail on non-zero exit", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd, args) => args[0] === "analyze",
				result: { stdout: "", stderr: "boom: segfault", code: 1 },
			},
		]);
		const cmd = createGitNexusIndexCommand(exec, () => "/bin/gitnexus");
		const { ctx, notifications } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);

		expect(notifications.at(-1)?.message).toContain("boom: segfault");
	});

	test("notifies cancelled on abort (killed=true)", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd, args) => args[0] === "analyze",
				result: { stdout: "", stderr: "", code: 0, killed: true },
			},
		]);
		const cmd = createGitNexusIndexCommand(exec, () => "/bin/gitnexus");
		const { ctx, notifications } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);

		expect(notifications.at(-1)?.message).toBe(MESSAGES.indexingCancelled);
	});

	test("honors explicit repo path argument", async () => {
		const customRoot = mkdtempSync(join(tmpdir(), "gitnexus-custom-"));
		try {
			const exec = createFakePiExec([
				{
					match: (cmd, args) => args[0] === "analyze",
					result: { stdout: "", stderr: "", code: 0 },
				},
			]);
			const cmd = createGitNexusIndexCommand(exec, () => "/bin/gitnexus");
			const { ctx } = createFakeCtx(repo);
			// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
			await cmd.handler(customRoot, ctx as any);
			expect(readFileSync(join(customRoot, ".gitignore"), "utf-8")).toBe(".gitnexus/\n");
		} finally {
			rmSync(customRoot, { recursive: true, force: true });
		}
	});

	test("never throws even on unexpected errors", async () => {
		const explodingExec = Object.assign(
			async () => {
				throw new Error("exec itself exploded");
			},
			{ calls: [] as Array<{ cmd: string; args: string[] }> },
		) as unknown as PiExec & { calls: Array<{ cmd: string; args: string[] }> };
		const cmd = createGitNexusIndexCommand(explodingExec, () => "/bin/gitnexus");
		const { ctx, notifications } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await expect(cmd.handler("", ctx as any)).resolves.toBeUndefined();
		expect(notifications.some((n) => n.level === "error")).toBe(true);
	});

	test("performs gitignore guard BEFORE exec'ing gitnexus", async () => {
		let gitignoreExistedBeforeExec = false;
		const baseExec = createFakePiExec([
			{
				match: (cmd, args) => args[0] === "analyze",
				result: { stdout: "", stderr: "", code: 0 },
			},
		]);
		// Wrap the exec to capture filesystem state when it is called.
		const wrapped = Object.assign(
			async (cmd: string, args: string[], opts?: Record<string, unknown>) => {
				gitignoreExistedBeforeExec = existsSync(join(repo, ".gitignore"));
				return baseExec(cmd, args, opts as never);
			},
			{ calls: baseExec.calls },
		) as unknown as PiExec & { calls: Array<{ cmd: string; args: string[] }> };
		const cmd = createGitNexusIndexCommand(wrapped, () => "/bin/gitnexus");
		const { ctx } = createFakeCtx(repo);
		// biome-ignore lint/suspicious/noExplicitAny: test-only ctx shape
		await cmd.handler("", ctx as any);

		expect(gitignoreExistedBeforeExec).toBe(true);
	});
});
