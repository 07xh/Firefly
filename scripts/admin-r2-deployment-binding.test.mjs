import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { configureOptionalFireflyR2 as configure } from "./admin-r2-deployment-binding.mjs";

const sample = () => ({
  main: "entrypoint",
  kv_namespaces: [
    { binding: "FIREFLY_SESSIONS", id: "a".repeat(32) },
    { binding: "SESSION", id: "b".repeat(32) },
  ],
  assets: { binding: "ASSETS", run_worker_first: true },
  vars: { SOME_OTHER_SETTING: "keep" },
});

test("R2 is OFF without explicit variables; existing deployments and bindings are unchanged", () => {
  const config = sample();
  const before = JSON.stringify(config);
  assert.deepEqual(configure(config), { enabled: false });
  assert.equal(JSON.stringify(config), before);
  assert.equal(config.r2_buckets, undefined);
  assert.equal(config.vars.FIREFLY_R2_PUBLIC_BASE_URL, undefined);
});

test("explicit nonsecret bucket and image domain become a durable generated R2 binding", () => {
  const config = sample();
  const result = configure(config, {
    bucketName: "firefly-images", publicBaseUrl: "https://img.0701000.xyz/",
  });
  assert.deepEqual(result, {
    enabled: true, bucketName: "firefly-images",
    publicBaseUrl: "https://img.0701000.xyz",
  });
  assert.deepEqual(config.r2_buckets, [{
    binding: "FIREFLY_IMAGE_R2", bucket_name: "firefly-images",
  }]);
  assert.equal(config.vars.FIREFLY_R2_PUBLIC_BASE_URL, "https://img.0701000.xyz");
  assert.equal(config.vars.SOME_OTHER_SETTING, "keep");
  assert.equal(config.kv_namespaces[0].id, "a".repeat(32));
  assert.equal(config.kv_namespaces[1].id, "b".repeat(32));
  assert.equal(config.assets.run_worker_first, true);
  // Deterministically re-applying settings must not create duplicate bindings.
  configure(config, {
    bucketName: "firefly-images", publicBaseUrl: "https://img.0701000.xyz",
  });
  assert.equal(config.r2_buckets.length, 1);
});

test("only one R2 variable must fail closed rather than silently enable broken image URLs", () => {
  for (const options of [
    { bucketName: "firefly-images" },
    { publicBaseUrl: "https://img.example.com" },
  ]) assert.throws(() => configure(sample(), options), /Both/);
});

test("unsafe bucket names, private domains, credentials and query strings cannot change Worker config", () => {
  for (const [bucket, url] of [
    ["Bad_Name", "https://img.example.com"],
    ["firefly-images", "http://img.example.com"],
    ["firefly-images", "https://localhost"],
    ["firefly-images", "https://127.0.0.1"],
    ["firefly-images", "https://user:pass@img.example.com"],
    ["firefly-images", "https://img.example.com/path?token=secret"],
    ["firefly-images", "https://img.example.com/#fragment"],
  ]) {
    const config = sample();
    const old = JSON.stringify(config);
    assert.throws(() => configure(config, {
      bucketName: bucket, publicBaseUrl: url,
    }));
    assert.equal(JSON.stringify(config), old);
  }
});

test("never overwrite a different original R2 binding or an existing protected URL", () => {
  const config = sample();
  config.r2_buckets = [{ binding: "PRIVATE_DRAFT_BACKUPS", bucket_name: "other" }];
  configure(config, {
    bucketName: "firefly-images", publicBaseUrl: "https://img.example.com",
  });
  assert.equal(config.r2_buckets.length, 2);
  assert.equal(config.r2_buckets[0].binding, "PRIVATE_DRAFT_BACKUPS");
  const conflicting = sample();
  conflicting.r2_buckets = [{ binding: "FIREFLY_IMAGE_R2", bucket_name: "different" }];
  assert.throws(() => configure(conflicting, {
    bucketName: "firefly-images", publicBaseUrl: "https://img.example.com",
  }), /Conflicting/);
  const conflictingUrl = sample();
  conflictingUrl.vars.FIREFLY_R2_PUBLIC_BASE_URL = "https://old.example.com";
  assert.throws(() => configure(conflictingUrl, {
    bucketName: "firefly-images", publicBaseUrl: "https://img.example.com",
  }), /Conflicting/);
});

test("production workflow binds only if both explicit Actions variables are present and preserves existing deploy path", () => {
  const workflow = readFileSync(new URL("../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");
  assert.match(workflow, /configureOptionalFireflyR2\(config/);
  assert.match(workflow, /vars\.FIREFLY_IMAGE_R2_BUCKET_NAME/);
  assert.match(workflow, /vars\.FIREFLY_R2_PUBLIC_BASE_URL/);
  assert.match(workflow, /pnpm exec wrangler deploy --config dist\/server\/wrangler\.json/);
  assert.match(workflow, /config\.kv_namespaces/);
  assert.match(workflow, /config\.assets\.run_worker_first = true/);
});
