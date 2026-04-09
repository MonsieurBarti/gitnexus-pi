export class AugmentCache {
	private readonly set = new Set<string>();

	has(key: string): boolean {
		return this.set.has(key);
	}

	add(key: string): void {
		this.set.add(key);
	}

	clear(): void {
		this.set.clear();
	}
}
