export function createFakeResolveRepo(result: string | null) {
	const calls: Array<{ cwd: string; override?: string }> = [];
	const fn = (ctx: { cwd: string }, override?: string): string | null => {
		calls.push({ cwd: ctx.cwd, override });
		return override !== undefined && override.length > 0 ? override : result;
	};
	return Object.assign(fn, { calls });
}
