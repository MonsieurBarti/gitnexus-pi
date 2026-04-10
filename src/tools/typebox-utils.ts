import { Type } from "@sinclair/typebox";

/**
 * Creates a string enum schema compatible with Google's API (no anyOf/const).
 * Mirrors `StringEnum` from `@mariozechner/pi-ai/utils/typebox-helpers` which
 * is not reachable via subpath exports at test time.
 */
export function StringEnum(values: string[], options?: { description?: string; default?: string }) {
	return Type.Unsafe<string>({ type: "string", enum: values, ...options });
}
