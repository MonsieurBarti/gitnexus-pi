import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The primary storage location for GitNexus indexes within this extension.
 *  We prefer .pi/.gitnexus over the root-level .gitnexus to keep project clutter minimal.
 */
export const GITNEXUS_STORAGE_PATH = ".pi/.gitnexus";

/**
 * Walk upward from startDir until a directory containing the GitNexus index is found.
 * Checks for `.pi/.gitnexus` first (preferred), then falls back to `.gitnexus` for legacy compatibility.
 * Returns the absolute path of that directory, or null if none exists between
 * startDir and the filesystem root.
 */
export function findGitNexusRoot(startDir: string): string | null {
	let current = resolve(startDir);

	while (true) {
		// Prefer .pi/.gitnexus (our preferred location)
		if (hasGitNexusDir(current, true)) {
			return current;
		}
		// Fall back to .gitnexus at root level (legacy compatibility)
		if (hasGitNexusDir(current, false)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

/**
 * Check if a directory has a GitNexus index.
 * @param dir - The directory to check
 * @param preferred - If true, check for .pi/.gitnexus; if false, check for .gitnexus
 */
function hasGitNexusDir(dir: string, preferred: boolean): boolean {
	const path = preferred ? join(dir, GITNEXUS_STORAGE_PATH) : join(dir, ".gitnexus");
	try {
		const stats = statSync(path);
		return stats.isDirectory();
	} catch {
		return false;
	}
}
