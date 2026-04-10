import { basename } from "node:path";
import type { AugmentCache } from "../augment-cache";
import type { GitNexusMcpClient, McpContentItem } from "../mcp-client";

type ToolResultEvent = {
	toolName: string;
	isError: boolean;
	content: McpContentItem[];
	input?: unknown;
};

type ToolResultPatch = {
	content: McpContentItem[];
};

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;

const MAX_PATHS = 3;
const PER_PATH_LIMIT = 3;
const AUGMENT_TIMEOUT_MS = 2000;
const GREP_PATTERN = /^([^\s:]+):\d+:/;
// Intentionally permissive: every non-empty line is treated as a path.
// find output is line-per-path; error/info lines may slip through but
// MAX_PATHS caps exposure and MCP query failures are silently recorded.
const FIND_PATTERN = /^(.+)$/;
const HOOKED_TOOLS = new Set(["grep", "find", "read"]);

export function createAugmentGrepHook(
	clientAccessor: ClientAccessor,
	cache: AugmentCache,
	augmentEnabled: () => boolean,
): (event: ToolResultEvent) => Promise<ToolResultPatch | undefined> {
	return async (event) => {
		if (!HOOKED_TOOLS.has(event.toolName) || event.isError) return undefined;
		if (!augmentEnabled()) return undefined;
		if (!Array.isArray(event.content)) return undefined;
		const client = clientAccessor();
		if (!client) return undefined;

		const paths = extractPaths(event);
		if (paths.length === 0) return undefined;

		const uncached = paths.filter((p) => !cache.has(p));
		if (uncached.length === 0) return undefined;

		const results = await Promise.allSettled(
			uncached.map((filePath) =>
				client
					.callTool(
						"query",
						{ query: basename(filePath), limit: PER_PATH_LIMIT },
						AbortSignal.timeout(AUGMENT_TIMEOUT_MS),
					)
					.then((content) => ({ filePath, content })),
			),
		);

		const parts: string[] = [];
		for (const r of results) {
			if (r.status !== "fulfilled") {
				cache.recordFailure();
				if (process.env.GITNEXUS_PI_DEBUG === "1") {
					console.error(r.reason);
				}
				continue;
			}
			const text = r.value.content
				.map((c) => (typeof c.text === "string" ? c.text : ""))
				.filter((s) => s.length > 0)
				.join("\n");
			if (text.length === 0) {
				cache.recordFailure();
				continue;
			}
			parts.push(`${r.value.filePath}:\n${text}`);
			cache.add(r.value.filePath);
			cache.recordSuccess();
		}

		if (parts.length === 0) return undefined;

		const augmentBlock = `\n\n--- GitNexus context ---\n${parts.join("\n\n")}`;
		return {
			content: [...event.content, { type: "text", text: augmentBlock }],
		};
	};
}

function extractPaths(event: ToolResultEvent): string[] {
	switch (event.toolName) {
		case "grep":
			return extractFromContentLines(event.content, GREP_PATTERN, MAX_PATHS);
		case "find":
			return extractFromContentLines(event.content, FIND_PATTERN, MAX_PATHS);
		case "read":
			return extractFromReadInput(event.input);
		/* v8 ignore next 2 */
		default:
			return [];
	}
}

function extractFromContentLines(
	content: McpContentItem[],
	pattern: RegExp,
	max: number,
): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of content) {
		if (typeof item.text !== "string") continue;
		for (const line of item.text.split("\n")) {
			if (line.trim().length === 0) continue;
			const match = pattern.exec(line);
			if (!match) continue;
			const filePath = match[1];
			if (seen.has(filePath)) continue;
			seen.add(filePath);
			out.push(filePath);
			if (out.length >= max) return out;
		}
	}
	return out;
}

function extractFromReadInput(input: unknown): string[] {
	if (typeof input !== "object" || input === null) return [];
	const path = (input as { path?: unknown }).path;
	return typeof path === "string" && path.length > 0 ? [path] : [];
}
