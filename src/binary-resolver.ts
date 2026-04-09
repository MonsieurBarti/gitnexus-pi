import { BinaryNotFoundError } from "./errors.ts";

export type PiExecResult = {
	stdout: string;
	stderr: string;
	code: number;
	killed?: boolean;
};

export type PiExec = (
	cmd: string,
	args: string[],
	opts?: { signal?: AbortSignal; timeout?: number; cwd?: string },
) => Promise<PiExecResult>;

/**
 * Locate the `gitnexus` binary. Resolution order:
 *  1. `GITNEXUS_PATH` env var (if set and file is executable)
 *  2. `which gitnexus`
 *  3. `/bin/sh -lc 'command -v gitnexus'` (login shell, picks up nvm/fnm/volta/asdf)
 * Throws `BinaryNotFoundError` if none succeed.
 */
export async function resolveBinary(exec: PiExec, env: NodeJS.ProcessEnv): Promise<string> {
	const fromEnv = env.GITNEXUS_PATH;
	if (fromEnv && fromEnv.length > 0) {
		const { code } = await exec("test", ["-x", fromEnv]);
		if (code === 0) {
			return fromEnv;
		}
	}

	const viaWhich = await exec("which", ["gitnexus"]);
	if (viaWhich.code === 0) {
		const path = viaWhich.stdout.trim();
		if (path.length > 0) {
			return path;
		}
	}

	const viaShell = await exec("/bin/sh", ["-lc", "command -v gitnexus"]);
	if (viaShell.code === 0) {
		const path = viaShell.stdout.trim();
		if (path.length > 0) {
			return path;
		}
	}

	throw new BinaryNotFoundError();
}
