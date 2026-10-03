import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Static token auth for the MCP endpoint. The token grants owner-level read
 * access (Phase 1). Set MCP_TOKEN in the environment; keep it out of any
 * frontend code.
 *
 * The token may be provided either as a bearer header
 * (`Authorization: Bearer <token>`) OR as a `key` query parameter
 * (`/mcp?key=<token>`). The query-param form exists because ChatGPT's custom
 * MCP connector only offers "OAuth" or "No auth" — no static-token field — so
 * the token is embedded in the URL and the connector is set to "No auth".
 * This is weaker than OAuth (the secret can appear in access logs); rotate
 * MCP_TOKEN if it leaks, and upgrade to OAuth 2.0 when feasible.
 */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  const key = req.query.key;
  if (typeof key === 'string' && key.length > 0) return key;
  return null;
}

export function mcpAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.MCP_TOKEN;
  if (!expected) {
    console.error('[mcp] MCP_TOKEN is not configured; refusing all requests.');
    res.status(503).json({ success: false, error: { code: 'MCP_NOT_CONFIGURED', message: 'MCP not configured.' } });
    return;
  }

  const token = extractToken(req);
  if (!token || !tokenMatches(token, expected)) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token.' } });
    return;
  }

  next();
}
