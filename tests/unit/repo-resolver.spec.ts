import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveRepoRoot } from "../../src/repo-resolver";

describe("resolveRepoRoot", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "repo-resolver-"));
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	test("returns override when non-empty string provided", () => {
		const result = resolveRepoRoot({ cwd: tmp }, "/custom/path");
		expect(result).toBe("/custom/path");
	});

	test("falls back to findGitNexusRoot when override undefined", () => {
		mkdirSync(join(tmp, ".gitnexus"));
		const result = resolveRepoRoot({ cwd: tmp });
		expect(result).toBe(tmp);
	});

	test("falls back to findGitNexusRoot when override is empty string", () => {
		mkdirSync(join(tmp, ".gitnexus"));
		const result = resolveRepoRoot({ cwd: tmp }, "");
		expect(result).toBe(tmp);
	});

	test("returns null when no override and no .gitnexus anywhere", () => {
		const result = resolveRepoRoot({ cwd: tmp });
		expect(result).toBeNull();
	});
});
