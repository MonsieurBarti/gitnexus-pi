import { Type } from "@sinclair/typebox";
import { MESSAGES } from "../errors";
import type { ClientAccessor, ToolDefinition } from "./types";

export function createGitNexusListReposTool(client: ClientAccessor): ToolDefinition {
	return {
		name: "tff-gitnexus_list_repos",
		readOnly: true,
		label: "GitNexus List Repos",
		description:
			"List all repositories that have been indexed by GitNexus. Read-only — safe to call in parallel with other read-only tools.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal, _onUpdate, _ctx) {
			const current = client();
			if (!current) {
				throw new Error(MESSAGES.clientNotAvailable);
			}
			const content = await current.callTool("list_repos", {}, signal);
			return { content, details: {} };
		},
	};
}
