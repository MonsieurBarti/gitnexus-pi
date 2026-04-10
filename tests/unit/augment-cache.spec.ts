import { beforeEach, describe, expect, test } from "vitest";
import { AugmentCache } from "../../src/augment-cache";

describe("AugmentCache", () => {
	let cache: AugmentCache;

	beforeEach(() => {
		cache = new AugmentCache();
	});

	test("has returns false for unknown key", () => {
		expect(cache.has("foo")).toBe(false);
	});

	test("add then has returns true", () => {
		cache.add("foo");
		expect(cache.has("foo")).toBe(true);
	});

	test("add is idempotent", () => {
		cache.add("foo");
		cache.add("foo");
		expect(cache.has("foo")).toBe(true);
	});

	test("keys are case-sensitive", () => {
		cache.add("Foo");
		expect(cache.has("foo")).toBe(false);
		expect(cache.has("Foo")).toBe(true);
	});

	test("clear removes all entries", () => {
		cache.add("foo");
		cache.add("bar");
		cache.clear();
		expect(cache.has("foo")).toBe(false);
		expect(cache.has("bar")).toBe(false);
	});

	test("add after clear works", () => {
		cache.add("foo");
		cache.clear();
		cache.add("foo");
		expect(cache.has("foo")).toBe(true);
	});

	test("recordSuccess increments successes getter", () => {
		cache.recordSuccess();
		cache.recordSuccess();
		expect(cache.successes).toBe(2);
	});

	test("recordFailure increments failures getter", () => {
		cache.recordFailure();
		expect(cache.failures).toBe(1);
	});

	test("has() on present key increments cacheHits", () => {
		cache.add("foo");
		cache.has("foo");
		cache.has("foo");
		expect(cache.cacheHits).toBe(2);
	});

	test("clear resets all counters in addition to the set", () => {
		cache.add("foo");
		cache.has("foo");
		cache.recordSuccess();
		cache.recordFailure();
		cache.clear();
		expect(cache.has("foo")).toBe(false);
		expect(cache.successes).toBe(0);
		expect(cache.failures).toBe(0);
		expect(cache.cacheHits).toBe(0);
	});
});
