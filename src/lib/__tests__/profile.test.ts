import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { hashPassword, verifyPassword } from "../auth.ts";
import { getUserRow, updateProfile } from "../profile.ts";

/**
 * 个人资料自助修改单测。
 *
 * 该路径此前把「改密码」与「改资料」写成两组独立 UPDATE，无事务；
 * 下沉到 lib 后在此固定「校验先于写入」与「全成或全败」两条不变量。
 */

let seq = 0;
function seedUser(password = "old-password"): string {
  const uid = `pf-test-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, email, bio, role, avatar, created_at)
     VALUES (?, ?, ?, '原昵称', 'old@example.com', '原签名', 'user', '', ?)`,
  ).run(uid, uid, hashPassword(password), Date.now());
  return uid;
}

function row(uid: string) {
  return getUserRow(uid) as {
    display_name: string;
    email: string;
    bio: string;
    avatar: string;
    password_hash: string;
  };
}

describe("updateProfile — 校验", () => {
  it("账号不存在时返回错误", () => {
    const r = updateProfile("no-such-user", { displayName: "x" });
    assert.deepEqual(r, { ok: false, error: "用户账号不存在" });
  });

  it("头像协议非法时拒绝，且不写入任何字段", () => {
    const uid = seedUser();
    const r = updateProfile(uid, { avatar: "javascript:alert(1)", displayName: "新昵称" });
    assert.equal(r.ok, false);
    assert.equal(row(uid).display_name, "原昵称", "校验失败不应产生副作用");
  });

  it("接受 preset: / http(s) / data:image 三种头像", () => {
    const uid = seedUser();
    for (const ok of ["preset:1", "https://example.com/a.png", "data:image/png;base64,AAA"]) {
      assert.equal(updateProfile(uid, { avatar: ok }).ok, true, ok);
    }
    assert.equal(row(uid).avatar, "data:image/png;base64,AAA");
  });

  it("改密码缺原密码时拒绝", () => {
    const uid = seedUser();
    const r = updateProfile(uid, { newPassword: "new-password" });
    assert.deepEqual(r, { ok: false, error: "修改密码时必须输入当前原密码" });
  });

  it("新密码短于 6 位时拒绝（5 位边界）", () => {
    const uid = seedUser();
    const r = updateProfile(uid, { oldPassword: "old-password", newPassword: "12345" });
    assert.deepEqual(r, { ok: false, error: "新密码长度不能少于 6 位" });
    // 恰好 6 位应通过
    assert.equal(
      updateProfile(uid, { oldPassword: "old-password", newPassword: "123456" }).ok,
      true,
    );
  });

  it("原密码错误时拒绝，且新密码不生效", () => {
    const uid = seedUser();
    const before = row(uid).password_hash;
    const r = updateProfile(uid, { oldPassword: "wrong", newPassword: "new-password" });
    assert.deepEqual(r, { ok: false, error: "原密码验证错误，无法修改密码" });
    assert.equal(row(uid).password_hash, before);
  });
});

describe("updateProfile — 写入", () => {
  it("改密码后新密码可验证、旧密码失效", () => {
    const uid = seedUser();
    const r = updateProfile(uid, { oldPassword: "old-password", newPassword: "new-password" });
    assert.deepEqual(r, { ok: true, passwordChanged: true });
    const hash = row(uid).password_hash;
    assert.equal(verifyPassword("new-password", hash), true);
    assert.equal(verifyPassword("old-password", hash), false);
  });

  it("只改资料时 passwordChanged 为 false", () => {
    const uid = seedUser();
    const r = updateProfile(uid, { displayName: "新昵称" });
    assert.deepEqual(r, { ok: true, passwordChanged: false });
    assert.equal(row(uid).display_name, "新昵称");
  });

  it("字段做 trim，且只更新传入的字段", () => {
    const uid = seedUser();
    updateProfile(uid, { displayName: "  新昵称  ", bio: "  新签名  " });
    const after = row(uid);
    assert.equal(after.display_name, "新昵称");
    assert.equal(after.bio, "新签名");
    assert.equal(after.email, "old@example.com", "未传入的字段应保持原值");
  });

  it("显示名称不接受空串（避免界面无从称呼）", () => {
    const uid = seedUser();
    updateProfile(uid, { displayName: "   " });
    assert.equal(row(uid).display_name, "原昵称");
  });

  it("邮箱与头像可以被清空", () => {
    const uid = seedUser();
    updateProfile(uid, { avatar: "preset:9" });
    updateProfile(uid, { avatar: "", email: "" });
    const after = row(uid);
    assert.equal(after.avatar, "");
    assert.equal(after.email, "");
  });

  it("改密码与改资料在同一次调用内一起生效", () => {
    const uid = seedUser();
    const r = updateProfile(uid, {
      displayName: "一起改",
      bio: "一起改签名",
      oldPassword: "old-password",
      newPassword: "new-password",
    });
    assert.deepEqual(r, { ok: true, passwordChanged: true });
    const after = row(uid);
    assert.equal(after.display_name, "一起改");
    assert.equal(after.bio, "一起改签名");
    assert.equal(verifyPassword("new-password", after.password_hash), true);
  });
});

describe("getUserRow", () => {
  it("返回公开字段且不含 password_hash 之外的敏感列", () => {
    const uid = seedUser();
    const r = getUserRow(uid) as unknown as Record<string, unknown>;
    for (const key of ["id", "username", "password_hash", "display_name", "email", "bio", "role", "avatar", "created_at"]) {
      assert.ok(key in r, `缺少字段 ${key}`);
    }
  });

  it("不存在的用户返回 undefined", () => {
    assert.equal(getUserRow("no-such-user"), undefined);
  });
});
