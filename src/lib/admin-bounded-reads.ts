/**
 * Map an ordered list while limiting the number of overlapping async reads.
 *
 * GitHub's secondary rate limits are sensitive to bursts. Public article
 * summaries should not request every Markdown file concurrently.
 */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32) {
		throw new RangeError("请求并发上限必须是 1–32 之间的整数。");
	}
	if (!Array.isArray(items) || typeof mapper !== "function") {
		throw new TypeError("并发读取参数不合法。");
	}
	const results = new Array<R>(items.length);
	let next = 0;
	async function worker() {
		for (;;) {
			const index = next++;
			if (index >= items.length) return;
			results[index] = await mapper(items[index], index);
		}
	}
	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		worker(),
	);
	await Promise.all(workers);
	return results;
}
