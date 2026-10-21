import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { publicAdminSystemHealth } = await import("../src/lib/admin-system-health.ts");

test("diagnostics never include configured secret values",()=>{
  const values={
    FIREFLY_ADMIN_PASSWORD:"NOT_FOR_LOGS_admin_password_123",
    FIREFLY_CONTENTS_TOKEN:"NOT_FOR_LOGS_github_pat_123",
    FIREFLY_SESSIONS:{id:"secret_namespace"},
    FIREFLY_PRIVATE_DRAFTS:{},
    FIREFLY_PRIVATE_DRAFT_BACKUPS:{},
    FIREFLY_PRIVATE_DRAFT_DB:{},
    FIREFLY_PRIVATE_DRAFT_BACKEND:"d1",
    IMG_BED_API_TOKEN:"NOT_FOR_LOGS_imgbed_123",
  };
  const health=publicAdminSystemHealth(values);
  const displayed=JSON.stringify(health);
  for(const forbidden of Object.values(values).filter(x=>typeof x==="string")) {
    if(forbidden==="d1")continue;
    assert.ok(!displayed.includes(forbidden),"unexpected private value in status response");
  }
  assert.equal(health.security.adminPasswordConfigured,true);
  assert.equal(health.articles.githubTokenConfigured,true);
  assert.equal(health.privateDrafts.backend,"d1");
  assert.equal(health.privateDrafts.r2BackupBound,true);
  assert.equal(health.issues.length,0);
});

test("missing bindings and active migration are visible without leaking secrets",()=>{
  const report=publicAdminSystemHealth({FIREFLY_PRIVATE_DRAFT_BACKEND:"kv",FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE:"true"});
  assert.equal(report.status,"maintenance");
  assert.equal(report.privateDrafts.migrationMode,true);
  assert.ok(report.issues.length>=3);
  assert.ok(report.issues.some(x=>x.includes("冻结")||x.includes("暂停")));
});

test("invalid backend names are never echoed to a UI",()=>{
  const report=publicAdminSystemHealth({FIREFLY_PRIVATE_DRAFT_BACKEND:"secret_backend_value"});
  assert.equal(report.privateDrafts.backend,"unknown");
  assert.ok(!JSON.stringify(report).includes("secret_backend_value"));
});

test("status endpoint is guarded by standard admin session middleware",()=>{
  const api=readFileSync(new URL("../src/pages/api/admin/system-health.ts",import.meta.url),"utf8");
  const middleware=readFileSync(new URL("../src/middleware.ts",import.meta.url),"utf8");
  const page=readFileSync(new URL("../src/pages/admin/system.astro",import.meta.url),"utf8");
  assert.ok(middleware.includes('pathname.startsWith("/api/admin/")'));
  assert.ok(middleware.includes('pathname.startsWith("/admin/")'));
  assert.ok(api.includes("publicAdminSystemHealth"));
  assert.ok(page.includes("系统运行状态"));
  assert.ok(!api.includes("return json(env)"));
});
