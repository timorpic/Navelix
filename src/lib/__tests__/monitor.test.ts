import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  parseQuotaSummary as parseAntigravityQuota,
  extractCloudAiCompanionProject,
} from "../monitor/providers/antigravity.ts";
import {
  codexWindowLabel,
  parseCodexIdToken,
} from "../monitor/providers/codex.ts";
import {
  parseQuotaSummary as parseLegacyQuota,
  parseCodexUsage,
  saveMonitorAccount,
  updateMonitorCredits,
  deleteMonitorAccount,
  listMonitorAccounts,
} from "../monitor/accounts.ts";
import { db } from "../db.ts";

describe("Antigravity quota summary parsing", () => {
  it("should map top-level buckets to a single 通用 group with 5H/7D bars", () => {
    const summary = parseAntigravityQuota({
      buckets: [
        {
          bucketId: "session",
          displayName: "5 Hours",
          remainingFraction: 0.45,
          resetTime: "2026-08-19T04:00:00Z",
        },
        {
          bucketId: "weekly",
          displayName: "Weekly Usage",
          remainingFraction: 0.9,
          resetTime: "2026-08-21T00:00:00Z",
        },
      ],
    }, 1000);

    assert.equal(summary.groups.length, 1);
    assert.equal(summary.groups[0].shortName, "通用");
    assert.deepEqual(
      summary.groups[0].windows.map((w) => w.key),
      ["5h", "weekly"],
    );
    assert.equal(summary.groups[0].windows[0].remainingFraction, 0.45);
    assert.equal(summary.groups[0].windows[1].remainingFraction, 0.9);
  });

  it("should group per-model buckets and sort groups by shortName", () => {
    const summary = parseAntigravityQuota({
      groups: [
        {
          displayName: "Gemini Models",
          buckets: [
            { bucketId: "session", remainingFraction: 0.7 },
            { bucketId: "weekly", remainingFraction: 0.99 },
          ],
        },
        {
          displayName: "Claude and GPT models",
          buckets: [
            { bucketId: "session", remainingFraction: 0.3 },
            { bucketId: "weekly", remainingFraction: 0.5 },
          ],
        },
      ],
    }, 2000);

    assert.equal(summary.groups.length, 2);
    // 按 shortName 排序：Claude 在前，Gemini 在后
    assert.deepEqual(summary.groups.map((g) => g.shortName), ["Claude", "Gemini"]);
    const claude = summary.groups[0];
    assert.equal(claude.windows.find((w) => w.key === "5h")?.remainingFraction, 0.3);
  });

  it("should coerce numeric strings and read nested remaining.remainingFraction", () => {
    const summary = parseAntigravityQuota({
      groups: [
        {
          displayName: "Nested",
          buckets: [
            { bucketId: "session", remaining: { remainingFraction: "0.61" } },
            { bucketId: "weekly", remainingFraction: "0.88" },
          ],
        },
      ],
    }, 3000);

    const group = summary.groups[0];
    assert.equal(group.windows.find((w) => w.key === "5h")?.remainingFraction, 0.61);
    assert.equal(group.windows.find((w) => w.key === "weekly")?.remainingFraction, 0.88);
  });

  it("should exclude window labels that also mention weekly from the 5h matcher", () => {
    const summary = parseAntigravityQuota({
      buckets: [
        { bucketId: "quota", displayName: "5 Hours weekly reset", remainingFraction: 0.2 },
      ],
    }, 4000);

    // 5h 匹配器被 weekly 关键词排除（防误判），该桶只会落入 weekly 条
    assert.equal(summary.groups.length, 1);
    assert.deepEqual(
      summary.groups[0].windows.map((w) => w.key),
      ["weekly"],
    );
  });

  it("should return empty groups when no recognizable window data", () => {
    const summary = parseAntigravityQuota({ buckets: [{ bucketId: "custom", remainingFraction: 0.5 }] }, 5000);
    assert.equal(summary.groups.length, 0);
    assert.equal(summary.buckets.length, 1);
  });

  it("should tolerate null / malformed payload", () => {
    assert.deepEqual(parseAntigravityQuota(null, 1).groups, []);
    assert.deepEqual(parseAntigravityQuota(undefined, 1).groups, []);
    assert.deepEqual(parseAntigravityQuota("not-an-object", 1).groups, []);
  });
});

describe("extractCloudAiCompanionProject", () => {
  it("should prefer cloudaicompanionProject, then projectId, then project.id", () => {
    assert.equal(
      extractCloudAiCompanionProject({ cloudaicompanionProject: "p-a", projectId: "p-b", project: { id: "p-c" } }),
      "p-a",
    );
    assert.equal(
      extractCloudAiCompanionProject({ projectId: "p-b", project: { id: "p-c" } }),
      "p-b",
    );
    assert.equal(extractCloudAiCompanionProject({ project: { id: "p-c" } }), "p-c");
    assert.equal(extractCloudAiCompanionProject({}), "");
  });
});

describe("Codex window label", () => {
  it("should map common windows to compact labels", () => {
    assert.equal(codexWindowLabel(30 * 86400), "30D");
    assert.equal(codexWindowLabel(7 * 86400), "7D");
    assert.equal(codexWindowLabel(86400), "24H");
    assert.equal(codexWindowLabel(5 * 3600), "5H");
    assert.equal(codexWindowLabel(365 * 86400), "1Y");
  });

  it("should format arbitrary durations", () => {
    assert.equal(codexWindowLabel(12 * 86400), "12D");
    assert.equal(codexWindowLabel(3 * 3600), "3H");
  });

  it("should guard null / non-positive / wrong-type inputs", () => {
    assert.equal(codexWindowLabel(null), "窗口");
    assert.equal(codexWindowLabel(0), "窗口");
    assert.equal(codexWindowLabel(-5), "窗口");
    assert.equal((codexWindowLabel as (v: never) => string)(undefined as never), "窗口");
  });
});

describe("Codex id_token claims parsing", () => {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o), "utf8").toString("base64url");
  const makeToken = (payload: unknown) =>
    `${enc({ alg: "none", typ: "JWT" })}.${enc(payload)}.sig`;

  it("should extract email, accountId, planType and subscription dates", () => {
    const token = makeToken({
      email: "user@example.com",
      "https://api.openai.com/auth": {
        chatgpt_account_id: "acct_123",
        chatgpt_plan_type: "chatgptplus",
        chatgpt_subscription_active_start: 1789646392,
        chatgpt_subscription_active_until: 1792238392,
      },
    });

    const claims = parseCodexIdToken(token);
    assert.equal(claims.email, "user@example.com");
    assert.equal(claims.accountId, "acct_123");
    assert.equal(claims.planType, "chatgptplus");
    assert.equal(claims.subscriptionStart, new Date(1789646392 * 1000).toISOString());
    assert.equal(claims.subscriptionUntil, new Date(1792238392 * 1000).toISOString());
  });

  it("should tolerate missing nested claims and malformed tokens", () => {
    const empty = parseCodexIdToken("");
    assert.deepEqual(empty, {
      email: "",
      planType: "",
      subscriptionStart: "",
      subscriptionUntil: "",
      accountId: "",
    });

    const missingAuth = parseCodexIdToken(`${enc(1)}.${enc({ email: "a@b.c" })}.sig`);
    assert.equal(missingAuth.email, "a@b.c");
    assert.equal(missingAuth.accountId, "");

    const garbage = parseCodexIdToken("not.a.jwt");
    assert.equal(garbage.email, "");
  });
});

describe("Legacy monitor quota normalization (accounts.parseQuotaSummary)", () => {
  it("should pass through the new groups[].windows[] structure", () => {
    const raw = JSON.stringify({
      groups: [
        { name: "Claude", shortName: "Claude", windows: [{ key: "5h", label: "5H", remainingFraction: 0.8, resetTime: "" }] },
      ],
      fetchedAt: 123,
      status: { paidTierId: "arc" },
    });
    const parsed = parseLegacyQuota(raw);
    assert.ok(parsed);
    assert.equal(parsed?.groups.length, 1);
    assert.equal(parsed?.groups[0].windows[0].remainingFraction, 0.8);
    assert.equal(parsed?.status?.paidTierId, "arc");
  });

  it("should normalize legacy window-without-groups into a 通用 group", () => {
    const raw = JSON.stringify({
      windows: [{ key: "5h", label: "5H", remainingFraction: 0.4, resetTime: "2026-08-19T04:00:00Z" }],
    });
    const parsed = parseLegacyQuota(raw);
    assert.ok(parsed);
    assert.equal(parsed?.groups[0].shortName, "通用");
    assert.equal(parsed?.groups[0].windows[0].remainingFraction, 0.4);
  });

  it("should normalize legacy windows[].groups[] into grouped bars", () => {
    const raw = JSON.stringify({
      windows: [
        {
          key: "weekly",
          groups: [
            { name: "Gemini", remainingFraction: 0.9 },
            { name: "Claude", remainingFraction: 0.7 },
          ],
        },
      ],
    });
    const parsed = parseLegacyQuota(raw);
    assert.ok(parsed);
    // 遗留归一化：同一窗口内的多个组丢失分组身份，全部挂在首个具名组下
    assert.equal(parsed?.groups.length, 1);
    assert.equal(parsed?.groups[0].shortName, "Gemini");
    assert.equal(parsed?.groups[0].windows.length, 2);
  });

  it("should return null for empty / invalid input", () => {
    assert.equal(parseLegacyQuota(""), null);
    assert.equal(parseLegacyQuota("not json"), null);
    assert.equal(parseLegacyQuota(JSON.stringify({ windows: "wrong" })), null);
  });
});

describe("Codex usage parse (accounts.parseCodexUsage)", () => {
  it("should pass through valid usage payloads", () => {
    const usage = {
      allowed: true,
      plan_type: "free",
      primary_window: { used_percent: 42, window_seconds: 2592000 },
    };
    const parsed = parseCodexUsage(JSON.stringify(usage));
    assert.ok(parsed);
    assert.equal(parsed?.allowed, true);
    // primary_window 在原始 payload 中是蛇形命名，parseCodexUsage 原样透传
    assert.equal(
      (parsed as unknown as Record<string, unknown>).primary_window?.["used_percent" as never],
      42,
    );
  });

  it("should reject payloads missing the allowed boolean", () => {
    assert.equal(parseCodexUsage(JSON.stringify({ plan_type: "free" })), null);
    assert.equal(parseCodexUsage("garbage"), null);
  });
});

describe("Monitor account DB behaviors", () => {
  const ownerId = `test-monitor-${Date.now()}`;
  const email = `monitor-dedup-${Date.now()}@test.local`;

  before(() => {
    db.prepare(
      "INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)",
    ).run(ownerId, `monitor-${Date.now()}`, "x:y", "Monitor Test", Date.now());
  });

  it("should deduplicate accounts by (user_id, provider, email)", () => {
    const a = saveMonitorAccount(ownerId, {
      provider: "codex",
      email,
      label: "A",
      accessToken: "token-a",
      refreshToken: "refresh-a",
      tokenExpiresAt: 0,
      planType: "free",
    });
    const b = saveMonitorAccount(ownerId, {
      provider: "codex",
      email,
      label: "B",
      accessToken: "token-b",
      refreshToken: "refresh-b",
      tokenExpiresAt: 0,
      planType: "free",
    });
    assert.equal(a, b, "Same provider+email should reuse the same row");
    const accounts = listMonitorAccounts(ownerId);
    assert.equal(accounts.filter((x) => x.email === email).length, 1);
  });

  it("should keep existing project_id when upstream returns empty", () => {
    const id = saveMonitorAccount(ownerId, {
      provider: "antigravity",
      email: `proj-${Date.now()}@test.local`,
      label: "Proj",
      accessToken: "token",
      tokenExpiresAt: 0,
    });
    updateMonitorCredits(id, {
      creditAmount: 100,
      minCreditAmount: 10,
      projectId: "proj-keep",
    });
    updateMonitorCredits(id, {
      creditAmount: 50,
      minCreditAmount: 5,
      projectId: "",
    });
    const row = db
      .prepare("SELECT project_id FROM model_accounts WHERE id = ?")
      .get(id) as { project_id: string };
    assert.equal(row.project_id, "proj-keep");
    deleteMonitorAccount(ownerId, id);
  });

  after(() => {
    db.prepare("DELETE FROM model_accounts WHERE user_id = ?").run(ownerId);
    db.prepare("DELETE FROM users WHERE id = ?").run(ownerId);
  });
});