import assert from "node:assert/strict";
import test from "node:test";
import { mapWithConcurrency } from "../src/lib/admin-article-batch.ts";

test("bounded work never exceeds the concurrency limit and preserves input order", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapWithConcurrency(Array.from({ length: 19 }, (_, i) => i), 4, async (item) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, (19 - item) % 3));
    active--;
    return item * 2;
  });
  assert.ok(peak <= 4);
  assert.ok(peak >= 2);
  assert.deepEqual(result, Array.from({ length: 19 }, (_, i) => i * 2));
});

test("a rejected GitHub read stops scheduling remaining reads and propagates the error", async () => {
  const error = new Error("GitHub read failed");
  let started = 0;
  await assert.rejects(
    mapWithConcurrency(Array.from({ length: 30 }, (_, i) => i), 3, async (value) => {
      started++;
      if (value === 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3));
      return value;
    }),
    (actual) => actual === error,
  );
  assert.ok(started <= 3, "do not launch more work after the first failure");
});

test("empty batches and invalid limits have unambiguous behavior", async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async () => 0), []);
  await assert.rejects(mapWithConcurrency([1], 0, async (x) => x), RangeError);
  await assert.rejects(mapWithConcurrency([1], Number.POSITIVE_INFINITY, async (x) => x), RangeError);
});
