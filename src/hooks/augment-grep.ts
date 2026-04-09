import { basename } from "node:path";
import type { AugmentCache } from "../augment-cache.ts";
import type { GitNexusMcpClient, McpContentItem } from "../mcp-client.ts";

type ToolResultEvent = {
	name: string;
	isError: boolean;
	content: McpContentItem[];
};

type ToolResultPatch = {
	content: McpContentItem[];
};

type ClientAccessor = () => Pick<GitNexusMcpClient, "callTool"> | null;

const MAX_PATHS = 3;
const PER_PATH_LIMIT = 3;
const AUGMENT_TIMEOUT_MS = 2000;
const FILE_PATH_PATTERN = /^([^\s:]+):\d+:/;

export function createAugmentGrepHook(
	clientAccessor: ClientAccessor,
	cache: AugmentCache,
): (event: ToolResultEvent) => Promise<ToolResultPatch | undefined> {
	return async (event) => {
		if (event.name !== "grep" || event.isError) return undefined;
		const client = clientAccessor();
		if (!client) return undefined;

		const paths = extractTopFilePaths(event.content, MAX_PATHS);
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
			if (r.status !== "fulfilled") continue;
			const text = r.value.content
				.map((c) => (typeof c.text === "string" ? c.text : ""))
				.filter((s) => s.length > 0)
				.join("\n");
			if (text.length === 0) continue;
			parts.push(`${r.value.filePath}:\n${text}`);
			cache.add(r.value.filePath);
		}

		if (parts.length === 0) return undefined;

		const augmentBlock = `\n\n--- GitNexus context ---\n${parts.join("\n\n")}`;
		return {
			content: [...event.content, { type: "text", text: augmentBlock }],
		};
	};
}

function extractTopFilePaths(content: McpContentItem[], max: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of content) {
		if (typeof item.text !== "string") continue;
		for (const line of item.text.split("\n")) {
			const match = FILE_PATH_PATTERN.exec(line);
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
