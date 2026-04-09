import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GitignoreGuardError } from "../../src/errors.ts";
import { ensureGitnexusIgnored } from "../../src/gitignore-guard.ts";

describe("ensureGitnexusIgnored", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "gitnexus-guard-"));
	});

	afterEach(() => {
		try {
			chmodSync(repo, 0o755);
		} catch {
			/* best effort */
		}
		rmSync(repo, { recursive: true, force: true });
	});

	const read = () => readFileSync(join(repo, ".gitignore"), "utf-8");

	test("creates .gitignore with .gitnexus/ when file absent", () => {
		expect(ensureGitnexusIgnored(repo)).toBe("created");
		expect(read()).toBe(".gitnexus/\n");
	});

	test("appends .gitnexus/ to existing empty file", () => {
		writeFileSync(join(repo, ".gitignore"), "");
		expect(ensureGitnexusIgnored(repo)).toBe("added");
		expect(read()).toBe(".gitnexus/\n");
	});

	test("appends .gitnexus/ preserving existing lines", () => {
		writeFileSync(join(repo, ".gitignore"), "node_modules\ndist\n");
		expect(ensureGitnexusIgnored(repo)).toBe("added");
		expect(read()).toBe("node_modules\ndist\n.gitnexus/\n");
	});

	test("prepends newline when existing file lacks trailing newline", () => {
		writeFileSync(join(repo, ".gitignore"), "node_modules");
		expect(ensureGitnexusIgnored(repo)).toBe("added");
		expect(read()).toBe("node_modules\n.gitnexus/\n");
	});

	for (const variant of [
		".gitnexus",
		".gitnexus/",
		"/.gitnexus",
		"/.gitnexus/",
		"**/.gitnexus",
		"**/.gitnexus/",
	]) {
		test(`detects existing variant "${variant}" as already-present`, () => {
			writeFileSync(join(repo, ".gitignore"), `${variant}\n`);
			expect(ensureGitnexusIgnored(repo)).toBe("already-present");
			expect(read()).toBe(`${variant}\n`);
		});
	}

	test("ignores comment-only occurrences and appends", () => {
		writeFileSync(join(repo, ".gitignore"), "# .gitnexus/ used by gitnexus\n");
		expect(ensureGitnexusIgnored(repo)).toBe("added");
		expect(read()).toBe("# .gitnexus/ used by gitnexus\n.gitnexus/\n");
	});

	test("ignores lines with leading whitespace but same content", () => {
		// Whitespace-trimmed matching: "   .gitnexus/" is still a match.
		writeFileSync(join(repo, ".gitignore"), "   .gitnexus/  \n");
		expect(ensureGitnexusIgnored(repo)).toBe("already-present");
	});

	test("throws GitignoreGuardError on write permission denied", () => {
		// Make the repo directory read-only so .gitignore cannot be created.
		chmodSync(repo, 0o555);
		expect(() => ensureGitnexusIgnored(repo)).toThrow(GitignoreGuardError);
	});
});
