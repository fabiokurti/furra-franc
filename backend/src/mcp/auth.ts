import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Static bearer-token auth for the MCP endpoint. The token grants owner-level
 * read access (Phase 1). Set MCP_TOKEN in the environment; keep it out of any
 * frontend code. Can be upgraded to OAuth 2.0 later without touching the tools.
 */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function mcpAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.MCP_TOKEN;
  if (!expected) {
    console.error('[mcp] MCP_TOKEN is not configured; refusing all requests.');
    res.status(503).json({ success: false, error: { code: 'MCP_NOT_CONFIGURED', message: 'MCP not configured.' } });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token.' } });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token || !tokenMatches(token, expected)) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token.' } });
    return;
  }

  next();
}
