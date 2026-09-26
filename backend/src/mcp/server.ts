import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ToolError } from './lib';
import { allTools } from './tools';
import { recordAudit } from './audit';

/**
 * Builds a fresh McpServer with every read tool registered. Each handler is
 * wrapped with audit logging and error sanitization so raw errors (SQL, stack
 * traces, paths) are never returned to the model.
 */
function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'furra-franc-mcp', version: '1.0.0' });

  // Heterogeneous tools are registered in a loop, so per-tool arg types cannot
  // be inferred; registerTool is called untyped. The zod inputSchema still
  // validates every call at runtime.
  const register = server.registerTool.bind(server) as (
    name: string,
    config: unknown,
    cb: (args: Record<string, unknown>) => Promise<unknown>,
  ) => void;

  for (const tool of allTools) {
    register(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      (async (args: Record<string, unknown>) => {
        const started = Date.now();
        const requestId = randomUUID();
        try {
          const result = await tool.handler(args ?? {});
          void recordAudit({
            toolName: tool.name,
            inputParams: args,
            resultStatus: 'success',
            durationMs: Date.now() - started,
            requestId,
          });
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        } catch (err) {
          const isToolError = err instanceof ToolError;
          const code = isToolError ? (err as ToolError).code : 'INTERNAL_ERROR';
          const message = isToolError ? (err as ToolError).message : 'Ndodhi një gabim i brendshëm.';
          if (!isToolError) console.error(`[mcp] tool ${tool.name} failed:`, err);
          void recordAudit({
            toolName: tool.name,
            inputParams: args,
            resultStatus: 'error',
            errorCode: code,
            durationMs: Date.now() - started,
            requestId,
          });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: { code, message } }) }],
            isError: true,
          };
        }
      }),
    );
  }

  return server;
}

/**
 * Express handler for POST /mcp. Runs the MCP server in stateless mode: a new
 * server + transport per request, torn down when the response closes.
 */
export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request handling error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

/** Stateless transport does not support GET (SSE) or DELETE (session teardown). */
export function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
}
