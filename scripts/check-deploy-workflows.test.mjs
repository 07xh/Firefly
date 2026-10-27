import assert from "node:assert/strict";
import test from "node:test";
import {
	deploymentPolicyViolations,
	eventEnabled,
	onSection,
	PRODUCTION,
	LEGACY_WORKER,
	MANUAL_PAGES,
	DISABLED_PAGES,
	SCHEDULED,
	readWorkflows,
} from "./check-deploy-workflows.mjs";

const original = readWorkflows();
const modify = (file, update) => ({ ...original, [file]: update(original[file]) });
const errors = (files) => deploymentPolicyViolations(files).join("\n");

test("reviewed workflow policy allows the staged single-writer layout", () => {
	assert.deepEqual(deploymentPolicyViolations(original), []);
});

test("top-level YAML event detection ignores nested event descriptions", () => {
	assert.equal(eventEnabled("name: Demo\non:\n  workflow_dispatch:\njobs:\n  one:\n    steps:\n      - run: echo push:", "push"), false);
	assert.equal(eventEnabled("name: Demo\non:\n  push:\n    branches: [master]\njobs:\n  one:\n    steps: []", "push"), true);
	assert.equal(onSection("name: Demo\njobs:\n  test: true"), "");
});

test("canonical Pages must still publish from master but never from the repository root", () => {
	assert.match(errors(modify(MANUAL_PAGES, (text) => text.replace("  push:\n    branches: [ master ]\n", ""))), /Canonical GitHub Pages workflow/);
	assert.match(errors(modify(MANUAL_PAGES, (text) => text.replace("path: dist", "path: '.'"))), /must build dist/);
	assert.match(errors(modify(MANUAL_PAGES, (text) => text.replace("rm -rf dist\/admin", "echo skip"))), /exclude private admin/);
	for (const file of DISABLED_PAGES) {
		assert.match(errors(modify(file, (text) => text.replace("on:\n  workflow_dispatch:", "on:\n  push:\n    branches: [master]\n  workflow_dispatch:"))), /obsolete Pages/);
		assert.match(errors(modify(file, (text) => text.replace("if: " + "$" + "{{ false }}", "if: " + "$" + "{{ true }}"))), /remain inert/);
	}
});

test("missing opt-in or shared concurrency blocks legacy Worker deployment", () => {
	assert.match(errors(modify(LEGACY_WORKER, (text) => text.replace("ENABLE_LEGACY_WORKER_DEPLOY", "ENABLE_ANYTHING_ELSE"))), /manual opt-in/);
	assert.match(errors(modify(LEGACY_WORKER, (text) => text.replace("group: cloudflare-workers", "group: other-worker"))), /shared? a serial concurrency group|share a serial concurrency group/);
	assert.match(errors(modify(LEGACY_WORKER, (text) => text.replace("on:\n  workflow_dispatch:", "on:\n  push:\n    branches: [master]\n  workflow_dispatch:"))), /must not run automatically/);
});

test("scheduled publishing must retain canonical dispatch link", () => {
	assert.match(errors(modify(SCHEDULED, (text) => text.replace("deploy-cloudflare.yml/dispatches", "deploy-worker.yml/dispatches"))), /canonical Cloudflare/);
	assert.match(errors(modify(PRODUCTION, (text) => text.replace("  workflow_dispatch:", "  repository_dispatch:"))), /manual-dispatch trigger/);
	assert.match(errors(modify(PRODUCTION, (text) => text.replace("group: cloudflare-workers", "group: alternate"))), /serialize deployments/);
});

test("missing files or missing top-level triggers fail closed", () => {
	const file = { ...original };
	delete file[PRODUCTION];
	assert.match(errors(file), /missing workflow file/);
	assert.match(errors(modify(PRODUCTION, (text) => text.replace("on:\n  push:", "events:\n  push:"))), /Canonical Cloudflare deployment/);
});


test("Cloudflare Workers Builds cutover requires explicit two-stage opt-in", () => {
	assert.match(errors(modify(PRODUCTION, (text) => text.replace("FIREFLY_WORKERS_BUILDS_DISCONNECTED == 'true'", "FIREFLY_WORKERS_BUILDS_DISCONNECTED == 'false'"))), /verified Builds disconnection/);
	assert.match(errors(modify(PRODUCTION, (text) => text.replace("ENABLE_FIREFLY_GHA_DEPLOY == 'true'", "ENABLE_FIREFLY_GHA_DEPLOY == 'false'"))), /automatic deployment opt-in/);
	assert.match(errors(modify(SCHEDULED, (text) => text.replace("ENABLE_FIREFLY_GHA_DEPLOY == 'true'", "ENABLE_FIREFLY_GHA_DEPLOY == 'false'"))), /Scheduled publisher must not dispatch/);
});

test("canonical Worker deploy preserves Cloudflare runtime vars and does not prepublish secrets", () => {
	assert.match(errors(modify(PRODUCTION, (text) => text.replace("wrangler.json --keep-vars", "wrangler.json"))), /preserve dashboard runtime vars/);
	assert.match(errors(modify(PRODUCTION, (text) => text.replace('      - name: Deploy Worker', '      - name: Bad runtime secret mutation\\n        run: echo secret | pnpm exec wrangler secret put FIREFLY_ADMIN_PASSWORD\\n      - name: Deploy Worker'))), /must not deploy unreviewed runtime secret/);
});
