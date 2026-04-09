import type { PiExec, PiExecResult } from "../../../src/binary-resolver.ts";

export type FakePiExecScript = Array<{
	match: (cmd: string, args: string[]) => boolean;
	result: PiExecResult;
}>;

/**
 * Create a fake PiExec whose responses are scripted per call.
 * Calls are matched in declaration order. The first script entry whose
 * `match` returns true provides the result. Throws if no entry matches.
 *
 * The returned fake also records every call for assertion purposes.
 */
export function createFakePiExec(script: FakePiExecScript): PiExec & {
	calls: Array<{ cmd: string; args: string[] }>;
} {
	const calls: Array<{ cmd: string; args: string[] }> = [];
	const fn: PiExec = async (cmd, args) => {
		calls.push({ cmd, args });
		const entry = script.find((e) => e.match(cmd, args));
		if (!entry) {
			throw new Error(`FakePiExec: no script entry matched ${cmd} ${args.join(" ")}`);
		}
		return entry.result;
	};
	return Object.assign(fn, { calls });
}
