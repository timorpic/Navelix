/**
 * SenseNova 模型用量监控 — 核心模块（纯 fetch 版，无需无头浏览器）
 *
 * 用法（在你的 Next.js API route 中）：
 * ```ts
 * import { getUsage } from '@/lib/sensenova'
 *
 * export async function GET() {
 *   const data = await getUsage({
 *     username: process.env.SENSENOVA_USERNAME!,
 *     password: process.env.SENSENOVA_PASSWORD!,
 *     // 可选：
 *     accountId: process.env.SENSENOVA_ACCOUNT_ID,   // 不填用默认
 *     cacheToken: true,                              // false = 仅内存，不落盘
 *     models: ['sensenova-6.8-flash-lite', 'glm-5.2'],
 *   })
 *   return Response.json(data)
 * }
 * ```
 *
 * 登录原理（已逆向，纯 fetch 重放，不依赖 Playwright/Chromium）：
 *   SenseNova 登录是标准 OAuth2 授权码 + PKCE + Ory Hydra IAM 流程：
 *   1. 访问 /oauth2/auth 拿到 login_challenge
 *   2. 向 iam 的 /v1/auth/nova/login 提交账号密码（密码用 JWKS 公钥做
 *      RSA-OAEP(SHA-1)+A256GCM 的 JWE 加密；加密失败则明文兜底 is_encrypt:false）
 *   3. 取回 login_verifier → consent_verifier → 授权 code
 *   4. 用 code + code_verifier 向 /oauth2/token 换 access_token
 *   token 是同等于账号凭据的 JWT，缓存 50 分钟。
 *
 * ⚠️ 安全提示：
 *  - token 是等同账号凭据的 JWT，默认用「混淆级」密钥加密落盘。
 *    生产请设置环境变量 SENSENOVA_TOKEN_KEY 提供真实密钥，并将缓存目录限制在私有路径。
 *  - 凭据（账号密码）只走环境变量，本文件不硬编码密码。
 *  - 登录协议依赖商汤后台实现，若其改 OAuth/IAM 流程需同步更新本文件。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  publicEncrypt,
  randomBytes,
  scryptSync,
  createHash,
  constants as cryptoConstants,
} from 'crypto'

// ── 配置 ──

const API_BASE = 'https://platform.sensenova.cn/lite/console/v1'
const LOGIN_URL = 'https://platform.sensenova.cn/login'
const OAUTH_AUTH_URL = 'https://platform.sensenova.cn/oauth2/auth'
const OAUTH_TOKEN_URL = 'https://platform.sensenova.cn/oauth2/token'
const IAM_BASE = 'https://iam.sensecoreapi.cn/iam/authn/v1/auth'
const JWKS_URL = 'https://signin.sensecore.cn/.well-known/jwks.json'
const CLIENT_ID = 'nova'
const REDIRECT_URI = 'https://platform.sensenova.cn'
const SCOPE = 'openid offline offline_access'

// 默认 account_id：账号专属，请通过 config.accountId 覆盖为你自己的
const DEFAULT_ACCOUNT_ID = '019e9559-2147-7868-a0d5-1b23bd7a484a'

const DEFAULT_MODELS = [
  'sensenova-6.8-flash-lite',
  'sensenova-u1-fast',
  'deepseek-v4-flash',
  'glm-5.2',
]

// Token 缓存目录（项目根目录或用户目录）；缓存文件权限将设为 600
const CACHE_DIR = process.env.SENSENOVA_CACHE_DIR ?? join(homedir(), '.sensenova')
const CACHE_FILE = join(CACHE_DIR, 'token.json')

// ── 类型 ──

export interface ModelUsage {
  name: string
  remaining_pct: number
  remaining_label: string
}

export interface UsageResponse {
  models: ModelUsage[]
  timestamp: string
  account_id: string
}

export interface UsageConfig {
  username: string
  password: string
  /** 要查询的模型列表，默认 DEFAULT_MODELS */
  models?: string[]
  /** 账号 ID，默认 DEFAULT_ACCOUNT_ID（务必换成你自己的） */
  accountId?: string
  /** 是否把 token 加密落盘缓存（默认 true）；false = 仅内存 */
  cacheToken?: boolean
  /** token 落盘加密密钥（覆盖环境变量 SENSENOVA_TOKEN_KEY）；不设则用「混淆级」默认密钥 */
  tokenKey?: string
}

// ── Token 加解密（落盘加密）──

/**
 * 派生 32 字节 AES 密钥。
 * 设置了 SENSENOVA_TOKEN_KEY 即为「真实加密」；未设置则为「混淆级」，
 * 仅防止 token 被明文扫到，不能抵御本地有密钥的攻击者。
 */
// token 加密密钥覆盖：优先使用调用方从后台配置传入的 tokenKey，其次环境变量，最后默认「混淆级」密钥。
// 注：本模块为单实例共享，tokenKey 对所有请求一致（来自同一后台配置），并发覆盖无实际冲突。
let _tokenKeyOverride: string | undefined

function getTokenKey(): Buffer {
  const pass =
    _tokenKeyOverride ??
    process.env.SENSENOVA_TOKEN_KEY ??
    'navelix-sensenova-default-obfuscation-key'
  const salt = Buffer.from('navelix-sensenova-v1', 'utf-8')
  return scryptSync(pass, salt, 32)
}

function encryptToken(token: string): string {
  const key = getTokenKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(token, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // 格式：iv:tag:ciphertext（均 hex）
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decryptToken(data: string): string {
  const parts = data.split(':')
  if (parts.length !== 3) throw new Error('token 缓存格式非法')
  const [ivHex, tagHex, encHex] = parts
  const key = getTokenKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ])
  return dec.toString('utf-8')
}

// ── Token 缓存（内存 + 磁盘）──

interface TokenCache {
  token: string
  expiresAt: number // unix ms
}

const TOKEN_TTL_MS = 50 * 60 * 1000 // JWT 默认 1h，保守缓存 50 分钟

let _memCache: TokenCache | null = null
let _diskCacheEnabled = true

function ensureCacheDir(): void {
  if (!existsSync(/*turbopackIgnore: true*/ CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
}

function loadToken(): string | null {
  // 1) 内存缓存优先
  if (_memCache && _memCache.expiresAt > Date.now()) return _memCache.token
  _memCache = null

  // 2) 磁盘缓存
  if (!_diskCacheEnabled || !existsSync(/*turbopackIgnore: true*/ CACHE_FILE)) return null
  try {
    const obj = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as Record<string, unknown>
    if (typeof obj.expiresAt !== 'number' || obj.expiresAt <= Date.now()) return null
    let token: string
    if (typeof obj.token === 'string' && obj.v === 2) {
      token = decryptToken(obj.token) // 新加密格式
    } else if (typeof obj.token === 'string') {
      token = obj.token // 旧明文格式，兼容迁移
    } else {
      return null
    }
    if (!token || token.length < 20) return null
    _memCache = { token, expiresAt: obj.expiresAt as number }
    return token
  } catch {
    return null
  }
}

function saveToken(token: string): void {
  const expiresAt = Date.now() + TOKEN_TTL_MS
  _memCache = { token, expiresAt }

  if (!_diskCacheEnabled) return // 仅内存模式：不落盘
  try {
    ensureCacheDir()
    const payload = JSON.stringify({ v: 2, token: encryptToken(token), expiresAt })
    writeFileSync(CACHE_FILE, payload, 'utf-8')
    // 尽可能限制文件权限为属主可读写（Windows 上 chmod 多数被忽略，属正常）
    try { chmodSync(CACHE_FILE, 0o600) } catch { /* ignore on Windows */ }
  } catch (e) {
    console.warn('[sensenova] token 落盘失败，仅保留内存缓存:', e)
  }
}

function clearTokenCache(): void {
  _memCache = null
  try {
    if (existsSync(CACHE_FILE)) writeFileSync(CACHE_FILE, JSON.stringify({ v: 2, token: '', expiresAt: 0 }), 'utf-8')
  } catch { /* ignore */ }
}

// ── 带状态码的 API 错误 ──

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function fetchApi(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Referer: 'https://platform.sensenova.cn/console',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, `HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ── 纯 fetch 登录（OAuth2 授权码 + PKCE + Ory Hydra IAM）──

// 简易按 host 的 cookie jar（Hydra/Ory 用 cookie 绑定登录/授权会话）
const _cookieJar = new Map<string, Map<string, string>>()
function _hostOf(url: string): string {
  try { return new URL(url).host } catch { return url }
}
function _jarGet(host: string): string {
  const m = _cookieJar.get(host)
  if (!m || m.size === 0) return ''
  return [...m.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}
function _jarSet(host: string, setCookie: string[] | null | undefined): void {
  if (!setCookie || setCookie.length === 0) return
  let m = _cookieJar.get(host)
  if (!m) { m = new Map(); _cookieJar.set(host, m) }
  for (const sc of setCookie) {
    const first = sc.split(';')[0]
    const idx = first.indexOf('=')
    if (idx <= 0) continue
    m.set(first.slice(0, idx).trim(), first.slice(idx + 1).trim())
  }
}

function _b64url(buf: Buffer | string): string {
  return Buffer.from(buf as Buffer).toString('base64url')
}

function _genPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}
function _genState(): string {
  return randomBytes(12).toString('base64url')
}

/**
 * 用 JWKS 公钥(RSA-OAEP SHA-1 + A256GCM)加密密码，返回 JWE 紧凑串。
 * 失败时返回 null（调用方退化为明文 is_encrypt:false）。
 */
async function encryptPassword(password: string): Promise<string | null> {
  try {
    const res = await fetch(JWKS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const jwks = (await res.json()) as { keys?: Array<Record<string, unknown>> }
    const key = (jwks.keys ?? []).find((k) => k.kid === 'public:hydra.openid.id-token')
    if (!key) return null
    const pub = createPublicKey({ key: key as never, format: 'jwk' })
    const cek = randomBytes(32)
    const encKey = publicEncrypt(
      { key: pub, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
      cek,
    )
    const iv = randomBytes(12)
    const protectedHeader = Buffer.from(JSON.stringify({ alg: 'RSA-OAEP', enc: 'A256GCM' }))
    const protectedB64 = _b64url(protectedHeader)
    const cipher = createCipheriv('aes-256-gcm', cek, iv)
    cipher.setAAD(Buffer.from(protectedB64, 'ascii'))
    const ct = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [protectedB64, _b64url(encKey), _b64url(iv), _b64url(ct), _b64url(tag)].join('.')
  } catch {
    return null
  }
}

interface HttpResult {
  status: number
  location: string | null
  text: string
}

/** 手动处理重定向，便于抽取 Location 与 cookie（不自动跟随 3xx） */
async function httpReq(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<HttpResult> {
  const host = _hostOf(url)
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0', ...(opts.headers ?? {}) }
  const cookie = _jarGet(host)
  if (cookie) headers['Cookie'] = cookie
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body,
    redirect: 'manual',
  })
  const setCookie =
    typeof (res.headers as never as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as never as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : []
  _jarSet(host, setCookie)
  const text = await res.text()
  return { status: res.status, location: res.headers.get('location'), text }
}

function _extractParam(urlOrStr: string | null, name: string): string | null {
  if (!urlOrStr) return null
  const qIndex = urlOrStr.indexOf('?')
  const hashIndex = urlOrStr.indexOf('#')
  let qs = urlOrStr
  if (qIndex >= 0) qs = urlOrStr.slice(qIndex + 1)
  else if (hashIndex >= 0) qs = urlOrStr.slice(hashIndex + 1)
  const params = new URLSearchParams(qs)
  return params.get(name)
}

async function login(config: UsageConfig): Promise<string> {
  console.log('[sensenova] 纯 fetch 登录（OAuth2+PKCE+IAM）...')
  const { verifier: codeVerifier, challenge: codeChallenge } = _genPkce()
  const state = _genState()

  const authParams = (extra: Record<string, string> = {}): string => {
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      redirect_uri: REDIRECT_URI,
      state,
      scope: SCOPE,
      ...extra,
    })
    return p.toString()
  }

  // 1) 发起授权请求，拿到 login_challenge
  const r1 = await httpReq(`${OAUTH_AUTH_URL}?${authParams()}`, {})
  const loginChallenge = _extractParam(r1.location ?? r1.text, 'login_challenge')
  if (!loginChallenge) throw new Error('未获取到 login_challenge（授权流程异常）')

  // 2) iam 登录页重定向 + 3) 平台登录页（收集 cookie）
  await httpReq(`${IAM_BASE}/login?login_challenge=${encodeURIComponent(loginChallenge)}`, {}).catch(() => {})
  await httpReq(`${LOGIN_URL}?login_challenge=${encodeURIComponent(loginChallenge)}`, {}).catch(() => {})
  // 4) checkChallenge（与前端一致）
  await httpReq(`${IAM_BASE}/checkChallenge?challenge=${encodeURIComponent(loginChallenge)}`, {}).catch(() => {})

  // 5) 提交登录（密码加密；加密失败则明文兜底）
  const enc = await encryptPassword(config.password)
  const isEncrypt = enc !== null
  const r5 = await httpReq(`${IAM_BASE}/nova/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.username,
      password: enc ?? config.password,
      challenge: loginChallenge,
      is_encrypt: isEncrypt,
    }),
  })
  const loginVerifier = _extractLoginVerifier(r5.text)
  if (!loginVerifier) {
    throw new Error('登录失败：未获取到 login_verifier（凭据错误或登录接口变更）')
  }

  // 6) 带 login_verifier 回到 oauth2/auth → 直接拿到 code（已授权）或 consent_challenge
  const r6 = await httpReq(`${OAUTH_AUTH_URL}?${authParams({ login_verifier: loginVerifier })}`, {})
  const codeFrom6 = _extractParam(r6.location ?? r6.text, 'code')
  let code: string | null = codeFrom6

  if (!code) {
    const consentChallenge = _extractParam(r6.location ?? r6.text, 'consent_challenge')
    if (!consentChallenge) throw new Error('未获取到 consent_challenge（授权流程异常）')
    // 7) consent → 拿 consent_verifier
    const r7 = await httpReq(`${IAM_BASE}/consent?consent_challenge=${encodeURIComponent(consentChallenge)}`, {})
    const consentVerifier = _extractParam(r7.location ?? r7.text, 'consent_verifier')
    if (!consentVerifier) throw new Error('未获取到 consent_verifier（授权流程异常）')
    // 8) 带 consent_verifier 回到 oauth2/auth → 拿 code
    const r8 = await httpReq(`${OAUTH_AUTH_URL}?${authParams({ consent_verifier: consentVerifier })}`, {})
    code = _extractParam(r8.location ?? r8.text, 'code')
  }
  if (!code) throw new Error('未获取到授权 code（授权流程异常）')

  // 9) 用 code + code_verifier 换 token
  const tokenRes = await httpReq(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
      state,
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
    }).toString(),
  })
  let tokenJson: Record<string, unknown>
  try { tokenJson = JSON.parse(tokenRes.text) } catch { throw new Error('token 接口返回非 JSON: ' + tokenRes.text.slice(0, 200)) }
  const accessToken = tokenJson.access_token
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('未获取到 access_token: ' + tokenRes.text.slice(0, 200))
  }
  saveToken(accessToken)
  console.log('[sensenova] 登录成功，token 已加密缓存')
  return accessToken
}

/** 从 nova/login 响应抽取 login_verifier（兼容 redirect 字段 / 直接字段 / 文本） */
function _extractLoginVerifier(text: string): string | null {
  let fromRedirect: string | null = null
  try {
    const j = JSON.parse(text)
    const redirect: string | undefined = j.redirect ?? j.data?.redirect
    if (redirect) fromRedirect = _extractParam(redirect, 'login_verifier')
    if (!fromRedirect) {
      const direct = j.login_verifier ?? j.data?.login_verifier
      if (typeof direct === 'string') return direct
    }
  } catch { /* 非 JSON */ }
  if (fromRedirect) return fromRedirect
  const m = text.match(/login_verifier=([^&\s"']+)/)
  return m ? m[1] : null
}

let _loginLock: Promise<string> | null = null

async function getToken(config: UsageConfig): Promise<string> {
  const cached = loadToken()
  if (cached) return cached

  // 防止并发重复登录（同一时间多个请求同时触发重登）
  if (!_loginLock) {
    _loginLock = login(config).finally(() => { _loginLock = null })
  }
  return _loginLock
}

// ── 对外接口 ──

/**
 * 获取 SenseNova 各模型剩余配额百分比
 *
 * 首次调用会触发登录（纯 fetch，约 1-3 秒），
 * 后续使用缓存 token 直到过期自动重登。
 */
export async function getUsage(config: UsageConfig): Promise<UsageResponse> {
  _tokenKeyOverride = config.tokenKey
  _diskCacheEnabled = config.cacheToken !== false
  const accountId = config.accountId ?? DEFAULT_ACCOUNT_ID
  const models = config.models ?? DEFAULT_MODELS

  const fetchOnce = async (token: string): Promise<UsageResponse> => {
    const params = new URLSearchParams({ account_id: accountId })
    for (const m of models) params.append('model_ids', m)

    const raw = (await fetchApi(`/user/coding-plan/usages?${params}`, token)) as Record<string, unknown>
    const pcts = (raw.model_remaining_percent as Record<string, number>) ?? {}

    return {
      models: Object.entries(pcts)
        .map(([name, pct]) => {
          const n = Number(pct) || 0
          return { name, remaining_pct: n, remaining_label: `${n.toFixed(1)}%` }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      timestamp: new Date().toISOString(),
      account_id: accountId,
    }
  }

  let token: string
  try {
    token = await getToken(config)
  } catch (err) {
    // 缓存/登录失败，强制重新登录一次
    console.warn('[sensenova] token 获取失败，强制重登:', err)
    clearTokenCache()
    token = await login(config)
  }

  try {
    return await fetchOnce(token)
  } catch (err) {
    // 仅当 401（按状态码判定）才清缓存重登；其它错误直接抛出，避免掩盖真实故障/死循环
    if (err instanceof ApiError && err.status === 401) {
      console.warn('[sensenova] token 过期 (401)，清除缓存并重登')
      clearTokenCache()
      token = await login(config)
      return await fetchOnce(token)
    }
    throw err
  }
}

/**
 * 强制刷新 token（给定时任务用）
 */
export async function refreshToken(config: UsageConfig): Promise<void> {
  _tokenKeyOverride = config.tokenKey
  _diskCacheEnabled = config.cacheToken !== false
  clearTokenCache()
  await getToken(config)
}

/**
 * 健康检查（验证 token 是否有效）
 * 通过真实可用的用量接口做存活探测，比猜一个 /user/token 端点更可靠。
 */
export async function healthCheck(config: UsageConfig): Promise<{ ok: boolean; message: string }> {
  _tokenKeyOverride = config.tokenKey
  const token = loadToken()
  if (!token) return { ok: false, message: '无缓存的 token，需要登录' }

  try {
    const accountId = config.accountId ?? DEFAULT_ACCOUNT_ID
    const params = new URLSearchParams({ account_id: accountId })
    for (const m of (config.models ?? DEFAULT_MODELS)) params.append('model_ids', m)
    await fetchApi(`/user/coding-plan/usages?${params}`, token)
    return { ok: true, message: 'token 有效' }
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: `token 无效 (HTTP ${e.status})` }
    return { ok: false, message: String(e) }
  }
}
