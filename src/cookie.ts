/**
 * Claude Desktop Cookie decryption module
 *
 * macOS Chromium standard encryption scheme:
 * 1. Read Safe Storage password from Keychain
 * 2. PBKDF2(password, "saltysalt", 1003, 16, SHA1) → AES-128-CBC key
 * 3. encrypted_value format: v10 (3 bytes) + ciphertext, IV = 16 bytes of 0x20
 *
 * Windows Chromium encryption scheme:
 * 1. Read master key from Local State (DPAPI-protected)
 * 2. AES-256-GCM decrypt with v10 + nonce(12B) + ciphertext + tag(16B)
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { execFileSync } from 'node:child_process'
import { openReadonlyDb, queryAll } from './sqlite.js'

export interface DesktopCookies {
  sessionKey: string
  organizationId: string
  deviceId: string
  cfClearance: string
  cfBm: string
}

// ---- macOS-specific functions ----

/**
 * Get Claude Safe Storage password from macOS Keychain
 */
function getKeychainPassword(): string {
  try {
    const result = execFileSync('security', [
      'find-generic-password', '-w',
      '-s', 'Claude Safe Storage',
      '-a', 'Claude Key',
    ], { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
    return result.toString().trim()
  } catch (err: any) {
    throw new Error(
      `Failed to read Keychain: ${err?.message || 'unknown error'}\n` +
      'Please verify: 1) macOS system  2) Claude Desktop is installed and has been logged in'
    )
  }
}

/**
 * Derive AES-128-CBC key
 */
function deriveKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
}

/**
 * Decrypt a single Chromium Cookie value (macOS: AES-128-CBC)
 */
function decryptValue(encryptedValue: Buffer, key: Buffer): string {
  if (encryptedValue.length < 4) return ''
  const prefix = encryptedValue.subarray(0, 3).toString('utf-8')
  if (prefix !== 'v10') return ''

  const data = encryptedValue.subarray(3)
  const iv = Buffer.alloc(16, 0x20)
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    // Chromium has a 32-byte internal prefix before cookie value, skip it
    if (decrypted.length <= 32) return ''
    return decrypted.subarray(32).toString('utf-8')
  } catch {
    return ''
  }
}

/**
 * Find Claude Desktop Cookies DB path (macOS)
 */
function findCookiesDbPathDarwin(): string | null {
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'Cookies'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'Default', 'Cookies'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Read device ID from ant-did file (macOS)
 */
function findDeviceIdDarwin(): string {
  const candidates = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'ant-did'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'Default', 'ant-did'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim()
    } catch { /* continue */ }
  }
  return ''
}

/**
 * Extract cookies on macOS (Keychain + AES-128-CBC)
 */
async function extractCookiesDarwin(): Promise<DesktopCookies> {
  const dbPath = findCookiesDbPathDarwin()
  if (!dbPath) {
    throw new Error(
      'Claude Desktop Cookies database not found\n' +
      'Please verify Claude Desktop is installed and has been logged in at least once'
    )
  }

  const password = getKeychainPassword()
  const key = deriveKey(password)

  let db: any
  try {
    db = await openReadonlyDb(dbPath)
  } catch (err: any) {
    throw new Error(`Failed to open Cookies DB: ${err?.message}`)
  }

  const result: DesktopCookies = {
    sessionKey: '',
    organizationId: '',
    deviceId: '',
    cfClearance: '',
    cfBm: '',
  }

  try {
    const rows = queryAll(db,
      `SELECT name, encrypted_value, host_key FROM cookies WHERE host_key LIKE '%claude.ai%'`,
    )

    for (const row of rows) {
      const encBuf = row.encrypted_value instanceof Uint8Array
        ? Buffer.from(row.encrypted_value)
        : Buffer.alloc(0)
      const value = decryptValue(encBuf, key)
      if (!value) continue
      switch (row.name) {
        case 'sessionKey': result.sessionKey = value; break
        case 'lastActiveOrg': result.organizationId = value; break
        case 'anthropic-device-id': result.deviceId = value; break
        case 'cf_clearance': result.cfClearance = value; break
        case '__cf_bm': result.cfBm = value; break
      }
    }
  } finally {
    db.close()
  }

  if (!result.sessionKey) {
    throw new Error('sessionKey not found. Please verify Claude Desktop is logged in (able to chat normally).')
  }
  if (!result.organizationId) {
    throw new Error('lastActiveOrg not found. Please verify Claude Desktop is logged in.')
  }

  if (!result.deviceId) {
    result.deviceId = findDeviceIdDarwin()
  }

  return result
}

// ---- Windows-specific functions ----

/**
 * Find Claude Desktop Cookies DB path (Windows)
 * %APPDATA%\Claude\Cookies or %APPDATA%\Claude\Default\Cookies
 */
/**
 * Find Claude Desktop data root directory on Windows.
 * Checks both traditional Electron installer path (%APPDATA%\Claude)
 * and Windows Store sandboxed path (%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude).
 * Returns the most recently modified one if both exist.
 */
function findClaudeDataRootWindows(): string | null {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')

  const candidates: string[] = [
    path.join(appData, 'Claude'),
  ]

  // Windows Store app: %LOCALAPPDATA%\Packages\Claude_{publisherHash}\LocalCache\Roaming\Claude
  const packagesDir = path.join(localAppData, 'Packages')
  try {
    for (const entry of fs.readdirSync(packagesDir)) {
      if (entry.startsWith('Claude_')) {
        candidates.push(path.join(packagesDir, entry, 'LocalCache', 'Roaming', 'Claude'))
      }
    }
  } catch { /* Packages dir not accessible */ }

  // Pick the one with the most recently modified Cookies file
  let best: string | null = null
  let bestMtime = 0
  for (const dir of candidates) {
    for (const cookiePath of ['Network/Cookies', 'Cookies', 'Default/Cookies']) {
      const full = path.join(dir, cookiePath)
      try {
        const mtime = fs.statSync(full).mtimeMs
        if (mtime > bestMtime) { bestMtime = mtime; best = dir }
      } catch { /* not found */ }
    }
  }
  return best
}

function findCookiesDbPathWindows(): string | null {
  const root = findClaudeDataRootWindows()
  if (!root) return null
  for (const sub of ['Network/Cookies', 'Cookies', 'Default/Cookies']) {
    const p = path.join(root, sub)
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Find Local State file for Claude Desktop (Windows)
 */
function findLocalStatePath(): string | null {
  const root = findClaudeDataRootWindows()
  if (root) {
    const p = path.join(root, 'Local State')
    if (fs.existsSync(p)) return p
  }
  // Fallback: check %LOCALAPPDATA%\Claude directly
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  const fallback = path.join(localAppData, 'Claude', 'Local State')
  if (fs.existsSync(fallback)) return fallback
  return null
}

/**
 * Read device ID from ant-did file (Windows)
 */
function findDeviceIdWindows(): string {
  const root = findClaudeDataRootWindows()
  const candidates = root
    ? [path.join(root, 'ant-did'), path.join(root, 'Default', 'ant-did')]
    : []
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim()
    } catch { /* continue */ }
  }
  return ''
}

/**
 * Extract cookies on Windows (DPAPI + AES-256-GCM)
 */
async function extractCookiesWindows(): Promise<DesktopCookies> {
  const { getChromiumKeyFromLocalState, decryptChromiumValueWindows } = await import('./dpapi.js')

  const dbPath = findCookiesDbPathWindows()
  if (!dbPath) {
    throw new Error(
      'Claude Desktop Cookies database not found\n' +
      'Please verify Claude Desktop is installed and has been logged in at least once'
    )
  }

  const localStatePath = findLocalStatePath()
  if (!localStatePath) {
    throw new Error('Claude Desktop Local State file not found')
  }

  const key = getChromiumKeyFromLocalState(localStatePath)

  let db: any
  try {
    db = await openReadonlyDb(dbPath)
  } catch (err: any) {
    throw new Error(`Failed to open Cookies DB: ${err?.message}`)
  }

  const result: DesktopCookies = {
    sessionKey: '',
    organizationId: '',
    deviceId: '',
    cfClearance: '',
    cfBm: '',
  }

  try {
    const rows = queryAll(db,
      `SELECT name, encrypted_value, host_key FROM cookies WHERE host_key LIKE '%claude.ai%'`,
    )

    for (const row of rows) {
      const encBuf = row.encrypted_value instanceof Uint8Array
        ? Buffer.from(row.encrypted_value)
        : Buffer.alloc(0)
      const value = decryptChromiumValueWindows(encBuf, key)
      if (!value) continue
      switch (row.name) {
        case 'sessionKey': result.sessionKey = value; break
        case 'lastActiveOrg': result.organizationId = value; break
        case 'anthropic-device-id': result.deviceId = value; break
        case 'cf_clearance': result.cfClearance = value; break
        case '__cf_bm': result.cfBm = value; break
      }
    }
  } finally {
    db.close()
  }

  if (!result.sessionKey) {
    throw new Error('sessionKey not found. Please verify Claude Desktop is logged in (able to chat normally).')
  }
  if (!result.organizationId) {
    throw new Error('lastActiveOrg not found. Please verify Claude Desktop is logged in.')
  }

  if (!result.deviceId) {
    result.deviceId = findDeviceIdWindows()
  }

  return result
}

// ---- Public API ----

/**
 * Extract and decrypt all required cookies from Claude Desktop Cookies DB.
 * Dispatches to platform-specific implementation.
 */
export async function extractCookies(): Promise<DesktopCookies> {
  if (process.platform === 'win32') {
    return extractCookiesWindows()
  }
  if (process.platform === 'darwin') {
    return extractCookiesDarwin()
  }
  throw new Error(`Unsupported platform: ${process.platform}`)
}
