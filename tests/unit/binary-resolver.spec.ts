import { describe, expect, test } from "vitest";
import { resolveBinary } from "../../src/binary-resolver";
import { BinaryNotFoundError } from "../../src/errors";
import { createFakePiExec } from "./fakes/pi-exec-fake";

describe("resolveBinary", () => {
	test("returns GITNEXUS_PATH when set and file is executable", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd, args) => cmd === "test" && args[0] === "-x",
				result: { stdout: "", stderr: "", code: 0 },
			},
		]);
		const path = await resolveBinary(exec, { GITNEXUS_PATH: "/opt/gitnexus" });
		expect(path).toBe("/opt/gitnexus");
	});

	test("falls through when GITNEXUS_PATH points to non-executable", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd, args) => cmd === "test" && args[0] === "-x",
				result: { stdout: "", stderr: "", code: 1 },
			},
			{
				match: (cmd) => cmd === "which",
				result: { stdout: "/usr/local/bin/gitnexus\n", stderr: "", code: 0 },
			},
		]);
		const path = await resolveBinary(exec, { GITNEXUS_PATH: "/bad/path" });
		expect(path).toBe("/usr/local/bin/gitnexus");
	});

	test("uses `which gitnexus` when env var is unset", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd) => cmd === "which",
				result: { stdout: "/usr/local/bin/gitnexus\n", stderr: "", code: 0 },
			},
		]);
		const path = await resolveBinary(exec, {});
		expect(path).toBe("/usr/local/bin/gitnexus");
	});

	test("falls back to shell resolution when which misses", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd) => cmd === "which",
				result: { stdout: "", stderr: "", code: 1 },
			},
			{
				match: (cmd, args) =>
					cmd === "/bin/sh" && args[0] === "-lc" && args[1]?.includes("command -v gitnexus"),
				result: { stdout: "/Users/me/.nvm/.../gitnexus\n", stderr: "", code: 0 },
			},
		]);
		const path = await resolveBinary(exec, {});
		expect(path).toBe("/Users/me/.nvm/.../gitnexus");
	});

	test("throws BinaryNotFoundError when all tiers miss", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd) => cmd === "which",
				result: { stdout: "", stderr: "not found", code: 1 },
			},
			{
				match: (cmd, args) => cmd === "/bin/sh" && args[0] === "-lc",
				result: { stdout: "", stderr: "", code: 1 },
			},
		]);
		await expect(resolveBinary(exec, {})).rejects.toBeInstanceOf(BinaryNotFoundError);
	});

	test("trims trailing whitespace from resolved paths", async () => {
		const exec = createFakePiExec([
			{
				match: (cmd) => cmd === "which",
				result: { stdout: "  /usr/local/bin/gitnexus  \n", stderr: "", code: 0 },
			},
		]);
		const path = await resolveBinary(exec, {});
		expect(path).toBe("/usr/local/bin/gitnexus");
	});
});
