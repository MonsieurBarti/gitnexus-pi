import type { ChildProcess, SpawnOptions } from "node:child_process";
import { spawn as nodeSpawn } from "node:child_process";
import { McpClientError } from "./errors";

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export type McpContentItem = {
	type: string;
	text?: string;
	[key: string]: unknown;
};

const PROTOCOL_VERSION = "2024-11-05";
const CLOSE_TIMEOUT_MS = 2000;

type PendingCall = {
	resolve: (content: McpContentItem[]) => void;
	reject: (err: unknown) => void;
	signal?: AbortSignal;
	signalListener?: () => void;
};

type JsonRpcSuccess = {
	jsonrpc: "2.0";
	id: number;
	result: { content?: McpContentItem[] } & Record<string, unknown>;
};

type JsonRpcError = {
	jsonrpc: "2.0";
	id: number;
	error: { code: number; message: string; data?: unknown };
};

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/**
 * Persistent JSON-RPC client for `gitnexus mcp` over stdio.
 * Owns the child process lifecycle.
 */
export class GitNexusMcpClient {
	private child: ChildProcess | null = null;
	private nextId = 1;
	private readonly pending = new Map<number, PendingCall>();
	private buffer = "";
	private _dead = false;

	constructor(
		private readonly binaryPath: string,
		private readonly cwd: string,
		private readonly spawnFn: SpawnFn = nodeSpawn,
	) {}

	get dead(): boolean {
		return this._dead;
	}

	async start(): Promise<void> {
		if (this.child) {
			throw new McpClientError("client already started");
		}
		this.child = this.spawnFn(this.binaryPath, ["mcp"], {
			cwd: this.cwd,
			stdio: ["pipe", "pipe", "ignore"],
			env: process.env,
		});

		this.child.stdout?.on("data", (chunk: Buffer) => this.onStdout(chunk));
		this.child.on("exit", (code, signal) => this.onExit(code, signal));
		this.child.on("error", (err) => this.onError(err));

		try {
			await this.request("initialize", {
				protocolVersion: PROTOCOL_VERSION,
				capabilities: {},
				clientInfo: { name: "gitnexus-pi", version: "0.1.0" },
			});
		} catch (err) {
			this._dead = true;
			/* v8 ignore next */
			throw err instanceof McpClientError ? err : new McpClientError("initialize failed", err);
		}

		this.sendRaw({
			jsonrpc: "2.0",
			method: "notifications/initialized",
			params: {},
		});
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<McpContentItem[]> {
		if (this._dead || !this.child) {
			throw new McpClientError("gitnexus mcp client is dead");
		}
		if (signal?.aborted) {
			throw new McpClientError("aborted");
		}
		return this.request("tools/call", { name, arguments: args }, signal);
	}

	async close(): Promise<void> {
		if (!this.child || this._dead) {
			return;
		}
		const child = this.child;
		await new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
			}, CLOSE_TIMEOUT_MS);
			child.once("exit", () => {
				clearTimeout(timer);
				resolve();
			});
			child.kill("SIGTERM");
		});
		this._dead = true;
	}

	private request(
		method: string,
		params: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<McpContentItem[]> {
		const id = this.nextId++;
		return new Promise<McpContentItem[]>((resolve, reject) => {
			const pending: PendingCall = { resolve, reject, signal };

			if (signal) {
				if (signal.aborted) {
					reject(new McpClientError("aborted"));
					return;
				}
				const listener = () => {
					this.pending.delete(id);
					reject(new McpClientError("aborted"));
				};
				signal.addEventListener("abort", listener, { once: true });
				pending.signalListener = listener;
			}

			this.pending.set(id, pending);
			try {
				this.sendRaw({ jsonrpc: "2.0", id, method, params });
			} catch (err) {
				this.pending.delete(id);
				reject(new McpClientError("failed to write to child stdin", err));
			}
		});
	}

	private sendRaw(message: Record<string, unknown>): void {
		const line = `${JSON.stringify(message)}\n`;
		if (!this.child?.stdin) {
			throw new McpClientError("child stdin not available");
		}
		this.child.stdin.write(line);
	}

	private onStdout(chunk: Buffer): void {
		this.buffer += chunk.toString("utf-8");
		let newlineIndex = this.buffer.indexOf("\n");
		while (newlineIndex >= 0) {
			const line = this.buffer.slice(0, newlineIndex);
			this.buffer = this.buffer.slice(newlineIndex + 1);
			if (line.trim().length > 0) {
				this.handleLine(line);
			}
			newlineIndex = this.buffer.indexOf("\n");
		}
	}

	private handleLine(line: string): void {
		let msg: JsonRpcResponse;
		try {
			msg = JSON.parse(line);
		} catch {
			// Skip malformed lines silently.
			return;
		}
		if (typeof msg.id !== "number") {
			return;
		}
		const pending = this.pending.get(msg.id);
		if (!pending) {
			return;
		}
		this.pending.delete(msg.id);
		if (pending.signal && pending.signalListener) {
			pending.signal.removeEventListener("abort", pending.signalListener);
		}
		if ("error" in msg && msg.error) {
			pending.reject(new McpClientError(msg.error.message));
			return;
		}
		const result = "result" in msg ? msg.result : {};
		const content = (result as { content?: McpContentItem[] }).content;
		pending.resolve(content ?? []);
	}

	private onExit(code: number | null, signal: NodeJS.Signals | null): void {
		this._dead = true;
		const reason = new McpClientError(
			`gitnexus mcp child exited unexpectedly (code=${code}, signal=${signal})`,
		);
		for (const [, pending] of this.pending) {
			if (pending.signal && pending.signalListener) {
				pending.signal.removeEventListener("abort", pending.signalListener);
			}
			pending.reject(reason);
		}
		this.pending.clear();
	}

	private onError(err: Error): void {
		this._dead = true;
		const wrapped = new McpClientError("gitnexus mcp child errored", err);
		for (const [, pending] of this.pending) {
			if (pending.signal && pending.signalListener) {
				pending.signal.removeEventListener("abort", pending.signalListener);
			}
			pending.reject(wrapped);
		}
		this.pending.clear();
	}
}
