import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { getActiveAdminById, isVercelRuntime, type AdminRecord } from './db.ts';

let cachedSecret: string | null = null;

function getSessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }

  // On stateless serverless (e.g. Vercel), derive a consistent HMAC secret from SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY
  // so multiple serverless instances verify the same admin tokens if SESSION_SECRET wasn't explicitly set.
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (isVercelRuntime() && supabaseKey) {
    cachedSecret = crypto
      .createHash('sha256')
      .update(`${supabaseKey}:join-bajrang-dal-session-v1`)
      .digest('hex');
    return cachedSecret;
  }

  const secretFile = isVercelRuntime()
    ? path.join('/tmp', '.jbd_session_secret')
    : path.resolve(process.cwd(), 'data', '.session_secret');

  try {
    if (fs.existsSync(secretFile)) {
      cachedSecret = fs.readFileSync(secretFile, 'utf8').trim();
      if (cachedSecret) return cachedSecret;
    }
    const dir = path.dirname(secretFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, 'utf8');
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    cachedSecret = crypto.randomBytes(32).toString('hex');
    return cachedSecret;
  }
}

export interface TokenPayload {
  sub: string;
  role: 'super_admin' | 'sub_admin';
  exp: number;
}

export function signSessionToken(admin: AdminRecord): string {
  const payload: TokenPayload = {
    sub: admin.id,
    role: admin.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  admin?: Omit<AdminRecord, 'password_hash'>;
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7).trim();
    const payload = verifySessionToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const admin = await getActiveAdminById(payload.sub);
    if (!admin) {
      return res.status(401).json({ error: 'Admin account inactive or not found' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin privileges required' });
  }
  next();
}
