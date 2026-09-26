import { prisma } from '../lib/prisma';

export interface AuditEntry {
  toolName: string;
  inputParams?: unknown;
  resultStatus: 'success' | 'error';
  errorCode?: string;
  durationMs: number;
  requestId?: string;
  clientInfo?: string;
}

/**
 * Best-effort audit logging: a failure here (e.g. the ai_audit_logs table not
 * migrated yet) must never break a tool call. Never logs secrets/tokens.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.aiAuditLog.create({
      data: {
        toolName: entry.toolName,
        inputParams: (entry.inputParams as object) ?? undefined,
        resultStatus: entry.resultStatus,
        errorCode: entry.errorCode ?? null,
        durationMs: entry.durationMs,
        requestId: entry.requestId ?? null,
        clientInfo: entry.clientInfo ?? null,
      },
    });
  } catch (err) {
    console.error('[mcp] audit log write failed:', err);
  }
}
