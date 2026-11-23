import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const FALLBACK_SALT = 'avpx_salt_2026';
const FALLBACK_HASH_HEX =
  '8901a792d9918455e02c86051894a2e1074f6edfc9a53a1b5786ce07ac86a487';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const IN_MEMORY_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return (process.env.ADMIN_SESSION_SECRET ?? '').trim() || IN_MEMORY_SESSION_SECRET;
}

export function verifyAdminPasscode(candidate: string): boolean {
  const input = candidate.trim();
  if (!input) return false;

  const envPass = (process.env.ADMIN_PASSCODE ?? '').trim();
  if (envPass) {
    const a = crypto.scryptSync(input, 'env_pass_salt', 32);
    const b = crypto.scryptSync(envPass, 'env_pass_salt', 32);
    return crypto.timingSafeEqual(a, b);
  }

  const candidateBuf = crypto.scryptSync(input, FALLBACK_SALT, 32);
  const expectedBuf = Buffer.from(FALLBACK_HASH_HEX, 'hex');
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

export function issueAdminToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: expiresAt, nonce: crypto.randomBytes(8).toString('hex') })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

export function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yêu cầu đăng nhập quyền quản trị viên.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Phiên quản trị đã hết hạn hoặc không hợp lệ.' });
    return;
  }
  next();
}
