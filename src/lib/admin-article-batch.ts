/**
 * Run a fixed-size batch of async admin reads.
 * Preserves source ordering and waits for all active reads before reporting failure.
 * No changes to public content or the visitor-facing site.
 */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	if (!Number.isSafeInteger(limit) || limit < 1) {
		throw new RangeError("Concurrency limit must be a positive integer");
	}
	const result = new Array<R>(items.length);
	let nextIndex = 0;
	let failed = false;
	let firstError: unknown;

	const worker = async () => {
		while (!failed && nextIndex < items.length) {
			const index = nextIndex++;
			try {
				result[index] = await work(items[index] as T, index);
			} catch (error) {
				if (!failed) {
					firstError = error;
					failed = true;
				}
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));

	if (failed) throw firstError;
	return result;
}
