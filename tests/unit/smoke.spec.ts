import { describe, expect, test } from "vitest";
import gitnexusExtension from "../../src/index.ts";

describe("smoke", () => {
	test("default export is a function", () => {
		expect(typeof gitnexusExtension).toBe("function");
	});
});
