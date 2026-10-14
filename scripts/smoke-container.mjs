// Run against an isolated CI container. No user data or credentials are used.
const base = process.env.NAVELIX_SMOKE_URL || 'http://127.0.0.1:3721';
const origin = new URL(base).origin;
let ready = false;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch { /* startup */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) throw new Error('Container did not become ready');
const response = await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ username: 'admin', password: 'ci-test-password' }),
});
if (!response.ok || !(await response.json()).user?.id) throw new Error('Login failed');
const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const read = async () => {
  const res = await fetch(`${base}/api/user/data`, { headers: { Cookie: cookie } });
  if (!res.ok) throw new Error('Workspace read failed');
  const data = await res.json();
  if (!Array.isArray(data.categories) || !Array.isArray(data.links) || !data.config) throw new Error('Invalid workspace data');
  for (const key of ['aiApiKey', 'weatherApiKey']) if (key in data.config) throw new Error('Secret exposed');
  return data;
};
await read();
const save = await fetch(`${base}/api/user/data`, {
  method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ config: { customFooter: 'CI smoke' } }),
});
if (!save.ok || (await read()).config.customFooter !== 'CI smoke') throw new Error('Config persistence failed');
const hostileOrigin = new URL(origin); hostileOrigin.port = "3999";
const blocked = await fetch(`${base}/api/user/data`, { method: 'POST', headers: { Cookie: cookie, Origin: hostileOrigin.origin, 'Content-Type': 'application/json' }, body: '{"links":[]}' });
if (blocked.status !== 403) throw new Error('CSRF boundary failed');
console.log('Container authentication, workspace, persistence, secrets and CSRF checks passed.');
