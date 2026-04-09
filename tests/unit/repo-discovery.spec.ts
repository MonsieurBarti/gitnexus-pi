import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { findGitNexusRoot } from "../../src/repo-discovery";

describe("findGitNexusRoot", () => {
	let base: string;

	beforeEach(() => {
		base = mkdtempSync(join(tmpdir(), "gitnexus-discover-"));
	});

	afterEach(() => {
		rmSync(base, { recursive: true, force: true });
	});

	test("returns null when no .gitnexus is found", () => {
		const sub = join(base, "a", "b", "c");
		mkdirSync(sub, { recursive: true });
		expect(findGitNexusRoot(sub)).toBeNull();
	});

	test("finds .gitnexus in startDir itself", () => {
		mkdirSync(join(base, ".gitnexus"), { recursive: true });
		expect(findGitNexusRoot(base)).toBe(base);
	});

	test("finds .gitnexus in parent", () => {
		mkdirSync(join(base, ".gitnexus"), { recursive: true });
		const sub = join(base, "child");
		mkdirSync(sub);
		expect(findGitNexusRoot(sub)).toBe(base);
	});

	test("finds .gitnexus in grandparent", () => {
		mkdirSync(join(base, ".gitnexus"), { recursive: true });
		const sub = join(base, "a", "b");
		mkdirSync(sub, { recursive: true });
		expect(findGitNexusRoot(sub)).toBe(base);
	});

	test("returns nearest .gitnexus when multiple exist", () => {
		mkdirSync(join(base, ".gitnexus"), { recursive: true });
		const nested = join(base, "a");
		mkdirSync(join(nested, ".gitnexus"), { recursive: true });
		const sub = join(nested, "b");
		mkdirSync(sub, { recursive: true });
		expect(findGitNexusRoot(sub)).toBe(nested);
	});

	test("stops at filesystem root without finding anything", () => {
		// /tmp/gitnexus-discover-XXXX does not have .gitnexus, and walking up
		// the real filesystem will not find one either.
		expect(findGitNexusRoot(base)).toBeNull();
	});
});
