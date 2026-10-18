import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

it("constructs a candidate image from official repository context without a repository job output", () => {
  const digest = `sha256:${"a".repeat(64)}`;
  const result = spawnSync(process.execPath, ["scripts/image-reference.mjs"], {
    encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "ExampleOwner/Navelix", IMAGE_DIGEST: digest },
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `ghcr.io/exampleowner/navelix@${digest}`);
});

it("rejects missing or malformed context and digest before Docker can receive an invalid reference", () => {
  for (const [repository, digest] of [["", `sha256:${"a".repeat(64)}`], ["owner/repo", ""], ["owner/repo", "latest"], ["owner/repo/extra", `sha256:${"a".repeat(64)}`]]) {
    const result = spawnSync(process.execPath, ["scripts/image-reference.mjs"], {
      encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: repository, IMAGE_DIGEST: digest },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  }
});
