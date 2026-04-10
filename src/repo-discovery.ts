import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Walk upward from startDir until a directory containing `.gitnexus/` is found.
 * Returns the absolute path of that directory, or null if none exists between
 * startDir and the filesystem root.
 */
export function findGitNexusRoot(startDir: string): string | null {
	let current = resolve(startDir);

	while (true) {
		if (hasGitNexusDir(current)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

function hasGitNexusDir(dir: string): boolean {
	try {
		const stats = statSync(join(dir, ".gitnexus"));
		return stats.isDirectory();
	} catch {
		return false;
	}
}
