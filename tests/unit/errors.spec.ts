import { describe, expect, test } from "vitest";
import {
	BinaryNotFoundError,
	GitignoreGuardError,
	INSTALL_HINT,
	MESSAGES,
	McpClientError,
} from "../../src/errors";

describe("errors", () => {
	describe("BinaryNotFoundError", () => {
		test("has correct name and default message", () => {
			const err = new BinaryNotFoundError();
			expect(err.name).toBe("BinaryNotFoundError");
			expect(err.message).toBe("gitnexus binary not found on PATH");
			expect(err).toBeInstanceOf(Error);
		});
	});

	describe("McpClientError", () => {
		test("has correct name and accepts message + cause", () => {
			const cause = new Error("underlying");
			const err = new McpClientError("something broke", cause);
			expect(err.name).toBe("McpClientError");
			expect(err.message).toBe("something broke");
			expect(err.cause).toBe(cause);
		});

		test("cause is optional", () => {
			const err = new McpClientError("something broke");
			expect(err.cause).toBeUndefined();
		});
	});

	describe("GitignoreGuardError", () => {
		test("has correct name and accepts message + cause", () => {
			const cause = new Error("underlying");
			const err = new GitignoreGuardError("permission denied", cause);
			expect(err.name).toBe("GitignoreGuardError");
			expect(err.message).toBe("permission denied");
			expect(err.cause).toBe(cause);
		});
	});

	describe("INSTALL_HINT", () => {
		test("contains install command", () => {
			expect(INSTALL_HINT).toBe("Install: npm i -g gitnexus");
		});
	});

	describe("MESSAGES", () => {
		test("contains all required keys", () => {
			expect(MESSAGES.binaryNotFound).toContain("not found");
			expect(MESSAGES.binaryNotFound).toContain(INSTALL_HINT);
			expect(MESSAGES.binaryNotFoundForCommand).toContain("not installed");
			expect(MESSAGES.clientNotAvailable).toContain("gitnexus");
			expect(MESSAGES.gitignoreCreated).toBe("Created .gitignore with .gitnexus/");
			expect(MESSAGES.gitignoreAdded).toBe("Added .gitnexus/ to .gitignore");
			expect(MESSAGES.indexingCancelled).toBe("gitnexus analyze cancelled");
		});

		test("formatter functions produce expected strings", () => {
			expect(MESSAGES.indexingFailed("tail")).toBe("gitnexus analyze failed:\ntail");
			expect(MESSAGES.indexReady("/foo")).toBe("GitNexus index ready: /foo");
			expect(MESSAGES.extensionReady("/usr/bin/gitnexus")).toBe(
				"GitNexus ready (/usr/bin/gitnexus)",
			);
			expect(MESSAGES.initFailed("boom")).toBe("GitNexus init failed: boom");
		});
	});
});
