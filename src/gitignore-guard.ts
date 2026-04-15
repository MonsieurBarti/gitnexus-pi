import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GitignoreGuardError } from "./errors";

/** Entry added to .gitignore for the GitNexus index directory */
const GITIGNORE_ENTRY = ".pi/.gitnexus/";

/** All variants that match the gitignore entry (for detection) */
const VARIANTS = new Set([
	".pi/.gitnexus",
	".pi/.gitnexus/",
	"/.pi/.gitnexus",
	"/.pi/.gitnexus/",
	"**/.pi/.gitnexus",
	"**/.pi/.gitnexus/",
	// Legacy variants for backwards compatibility
	".gitnexus",
	".gitnexus/",
	"/.gitnexus",
	"/.gitnexus/",
	"**/.gitnexus",
	"**/.gitnexus/",
]);

/** Patterns that already cover .pi/.gitnexus/ (no need to add) */
const PI_COVERAGE_PATTERNS = new Set([".pi", ".pi/", "/.pi", "/.pi/", "**/.pi", "**/.pi/"]);

export type EnsureResult = "added" | "already-present" | "created";

/**
 * Ensure `.pi/.gitnexus/` is present in `<repoRoot>/.gitignore`.
 * Creates the file if missing, appends the entry if absent, or returns
 * "already-present" if any common variant is detected.
 */
export function ensureGitnexusIgnored(repoRoot: string): EnsureResult {
	const path = join(repoRoot, ".gitignore");

	let existing: string | null;
	try {
		existing = readFileSync(path, "utf-8");
	} catch (err) {
		if (isEnoent(err)) {
			try {
				writeFileSync(path, `${GITIGNORE_ENTRY}\n`);
				return "created";
			} catch (writeErr) {
				throw new GitignoreGuardError(`failed to create ${path}`, writeErr);
			}
		}
		throw new GitignoreGuardError(`failed to read ${path}`, err);
	}

	if (hasGitnexusEntry(existing)) {
		return "already-present";
	}

	const toAppend =
		existing.length > 0 && !existing.endsWith("\n")
			? `\n${GITIGNORE_ENTRY}\n`
			: `${GITIGNORE_ENTRY}\n`;

	try {
		appendFileSync(path, toAppend);
	} catch (err) {
		throw new GitignoreGuardError(`failed to append to ${path}`, err);
	}

	return "added";
}

function hasGitnexusEntry(content: string): boolean {
	for (const rawLine of content.split("\n")) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith("#")) {
			continue;
		}
		// Check for explicit gitnexus variants
		if (VARIANTS.has(line)) {
			return true;
		}
		// Check for .pi/ patterns that already cover .pi/.gitnexus/
		if (PI_COVERAGE_PATTERNS.has(line)) {
			return true;
		}
	}
	return false;
}

function isEnoent(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		(err as { code?: string }).code === "ENOENT"
	);
}
