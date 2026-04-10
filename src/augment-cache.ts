export class AugmentCache {
	private readonly set = new Set<string>();
	private _successes = 0;
	private _failures = 0;
	private _cacheHits = 0;

	has(key: string): boolean {
		const hit = this.set.has(key);
		if (hit) this._cacheHits++;
		return hit;
	}

	add(key: string): void {
		this.set.add(key);
	}

	clear(): void {
		this.set.clear();
		this._successes = 0;
		this._failures = 0;
		this._cacheHits = 0;
	}

	recordSuccess(): void {
		this._successes++;
	}

	recordFailure(): void {
		this._failures++;
	}

	get size(): number {
		return this.set.size;
	}

	get successes(): number {
		return this._successes;
	}

	get failures(): number {
		return this._failures;
	}

	get cacheHits(): number {
		return this._cacheHits;
	}
}
