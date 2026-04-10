export class BinaryNotFoundError extends Error {
	constructor() {
		super("gitnexus binary not found on PATH");
		this.name = "BinaryNotFoundError";
	}
}

export class McpClientError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "McpClientError";
	}
}

export class GitignoreGuardError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "GitignoreGuardError";
	}
}

export const INSTALL_HINT = "Install: npm i -g gitnexus";

export const MESSAGES = {
	binaryNotFound: `gitnexus binary not found on PATH. ${INSTALL_HINT}`,
	binaryNotFoundForCommand: `gitnexus not installed — cannot run index. ${INSTALL_HINT}`,
	clientNotAvailable: `gitnexus not available: binary not found or MCP client failed to start. ${INSTALL_HINT}`,
	indexingFailed: (stderrTail: string) => `gitnexus analyze failed:\n${stderrTail}`,
	indexingCancelled: "gitnexus analyze cancelled",
	gitignoreCreated: "Created .gitignore with .gitnexus/",
	gitignoreAdded: "Added .gitnexus/ to .gitignore",
	indexReady: (repoRoot: string) => `GitNexus index ready: ${repoRoot}`,
	extensionReady: (binaryPath: string) => `GitNexus ready (${binaryPath})`,
	initFailed: (msg: string) => `GitNexus init failed: ${msg}`,
	noIndexFound: `No .gitnexus/ index found for this directory. Run /gitnexus-index first. ${INSTALL_HINT}`,
	indexMissing:
		"GitNexus has no index for this repo — run /gitnexus-index to enable graph queries and auto-augment.",
	augmentDisabled:
		"GitNexus augment hook is disabled for this session (re-enable with /gitnexus-toggle-augment)",
} as const;
