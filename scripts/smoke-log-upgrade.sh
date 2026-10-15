#!/usr/bin/env bash
# Verify the deployed image against a legacy v20 database in a disposable Docker volume.
set -euo pipefail
image=${1:?Usage: smoke-log-upgrade.sh IMAGE}
name="navelix-log-upgrade-${GITHUB_RUN_ID:-$$}"
volume="${name}-data"
port=3724
work_dir=$(mktemp -d)
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker logs "$name" 2>/dev/null || true; fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
  exit "$result"
}
trap cleanup EXIT
docker volume create "$volume" >/dev/null
docker run --rm -i -v "$volume:/app/data" --entrypoint node "$image" - <<'JS'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/data/navelix.db');
db.exec(`CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
); PRAGMA user_version=20;`);
db.prepare('INSERT INTO audit_logs(id,user_id,action,details,created_at) VALUES (?,?,?,?,?)')
  .run('legacy-audit', 'legacy-user', 'legacy.fixture', 'preserved', Date.now());
db.close();
JS
docker run -d --name "$name" -v "$volume:/app/data" -p "$port:3721" \
  -e NAVELIX_ADMIN_PASSWORD=isolated-upgrade-test-password "$image" >/dev/null
ready=false
for attempt in {1..30}; do
  if curl -fsS "http://localhost:$port/login" -o /dev/null; then ready=true; break; fi
  sleep 2
done
[ "$ready" = true ] || { echo 'Legacy database startup failed'; exit 1; }
curl -fsS -c "$work_dir/cookies" "http://localhost:$port/api/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: http://localhost:$port" \
  -d '{"username":"admin","password":"isolated-upgrade-test-password"}' > "$work_dir/login.json"
python3 -c "import json,sys; assert json.load(open(sys.argv[1])).get('user',{}).get('id')" "$work_dir/login.json"
curl -fsS -b "$work_dir/cookies" "http://localhost:$port/api/admin/logs?limit=20" > "$work_dir/logs.json"
python3 -c "import json,sys; logs=json.load(open(sys.argv[1]))['logs']; assert any(row['id']=='legacy-audit' for row in logs), 'legacy audit lost'" "$work_dir/logs.json"
curl -fsS -b "$work_dir/cookies" "http://localhost:$port/api/user/locale" \
  -H 'Content-Type: application/json' -H "Origin: http://localhost:$port" \
  -d '{"language":"en"}' > "$work_dir/locale.json"
python3 -c "import json,sys; assert json.load(open(sys.argv[1]))['language']=='en'" "$work_dir/locale.json"
docker exec "$name" node -e '
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/app/data/navelix.db", { readOnly: true });
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 21);
for (const name of ["category", "event_json"]) assert.ok(db.prepare("PRAGMA table_info(audit_logs)").all().some(row => row.name === name));
assert.equal(db.prepare("SELECT details FROM audit_logs WHERE id=?").get("legacy-audit").details, "preserved");
assert.ok(db.prepare("SELECT count(*) AS c FROM audit_logs WHERE event_json != ?").get("").c > 0);
db.close();
'
echo 'Legacy v20 startup, authentication, log query, audited write and history preservation passed.'
