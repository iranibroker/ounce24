import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { McpService } from './mcp.service';
import { Public } from '../auth/public.decorator';
import { McpRole, McpAuthResult } from './mcp.types';

@Public()
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);
  private activeSseSessions = new Map<string, { res: Response; role: McpRole }>();

  constructor(private readonly mcpService: McpService) {}

  private resolveAuth(req: Request): McpAuthResult {
    const adminKey = process.env.MCP_API_KEY;
    const analystKey =
      process.env.MCP_ANALYST_API_KEY ||
      (adminKey ? `${adminKey}_analyst` : undefined);

    // Dev mode fallback: If no keys are set in environment, allow full access as admin
    if (!adminKey && !analystKey) {
      return { authorized: true, role: 'admin' };
    }

    const authHeader =
      typeof req.headers['authorization'] === 'string'
        ? req.headers['authorization']
        : '';
    const apiKeyHeader =
      req.headers['x-api-key'] || req.headers['x-mcp-api-key'] || '';
    const queryKey = req.query.apiKey || req.query.token || '';

    let providedKey = '';
    if (authHeader) {
      providedKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    } else if (apiKeyHeader) {
      providedKey = (
        Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : String(apiKeyHeader)
      ).trim();
    } else if (queryKey) {
      providedKey = (
        Array.isArray(queryKey) ? String(queryKey[0]) : String(queryKey)
      ).trim();
    }

    if (!providedKey) {
      return { authorized: false, role: 'analyst' };
    }

    if (adminKey && providedKey === adminKey) {
      return { authorized: true, role: 'admin' };
    }

    if (analystKey && providedKey === analystKey) {
      return { authorized: true, role: 'analyst' };
    }

    return { authorized: false, role: 'analyst' };
  }

  // Dual Transport: SSE stream endpoint or Non-SSE health check
  @Get()
  @Get('sse')
  handleGet(@Req() req: Request, @Res() res: Response) {
    const auth = this.resolveAuth(req);
    if (!auth.authorized) {
      this.logger.warn(`Unauthorized MCP GET request attempt from ${req.ip}`);
      return res.status(HttpStatus.UNAUTHORIZED).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid or missing MCP API key',
        },
      });
    }

    const acceptHeader = req.headers['accept'] || '';

    // If client requested SSE stream
    if (acceptHeader.includes('text/event-stream')) {
      const sessionId =
        (req.query.sessionId as string) ||
        `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      this.activeSseSessions.set(sessionId, { res, role: auth.role });

      const host = req.headers.host || 'localhost:3000';
      const protocol = req.protocol || 'http';
      const messageUrl = `${protocol}://${host}/api/mcp/messages?sessionId=${sessionId}`;

      // Send initial endpoint event according to MCP SSE standard
      res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

      // Heartbeat ping interval
      const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`: heartbeat\n\n`);
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeatInterval);
        this.activeSseSessions.delete(sessionId);
        this.logger.log(`SSE connection closed for sessionId: ${sessionId}`);
      });

      return;
    }

    // Non-SSE GET: Return HTTP 200 JSON status for browser/curl/health checks
    return res.status(HttpStatus.OK).json({
      name: 'Ounce24 Product & DB Analytics MCP',
      status: 'active',
      role: auth.role,
      version: '1.0.0',
      protocolVersion: '2024-11-05',
    });
  }

  // JSON-RPC 2.0 endpoints: POST /mcp and POST /mcp/messages
  @Post()
  @Post('messages')
  @HttpCode(HttpStatus.OK)
  async handlePost(@Req() req: Request, @Res() res: Response) {
    const body = req.body || {};
    const reqId = body.id !== undefined ? body.id : null;

    let auth = this.resolveAuth(req);

    // Fallback: If request is part of an active SSE session, inherit session's authenticated role
    const sessionId = req.query.sessionId as string;
    if (!auth.authorized && sessionId && this.activeSseSessions.has(sessionId)) {
      const session = this.activeSseSessions.get(sessionId);
      if (session) {
        auth = { authorized: true, role: session.role };
      }
    }

    if (!auth.authorized) {
      this.logger.warn(`Unauthorized MCP POST request attempt from ${req.ip}`);
      return res.status(HttpStatus.OK).json({
        jsonrpc: '2.0',
        id: reqId,
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid or missing API key',
        },
      });
    }

    const method = body.method;

    // Handle notifications (no response payload expected)
    if (method && method.startsWith('notifications/')) {
      return res.status(HttpStatus.OK).send();
    }

    try {
      let resultPayload: any = null;

      switch (method) {
        case 'initialize':
          resultPayload = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              prompts: {},
              resources: {},
            },
            serverInfo: {
              name: 'Ounce24 Product & DB Analytics MCP',
              version: '1.0.0',
              role: auth.role,
            },
          };
          break;

        case 'ping':
          resultPayload = {};
          break;

        case 'tools/list':
          resultPayload = {
            tools: this.mcpService.getToolsList(auth.role),
          };
          break;

        case 'tools/call':
          const toolName = body.params?.name;
          const toolArgs = body.params?.arguments || {};
          if (!toolName) {
            return res.status(HttpStatus.OK).json({
              jsonrpc: '2.0',
              id: reqId,
              error: {
                code: -32602,
                message: "Invalid params: 'name' is required for tools/call.",
              },
            });
          }

          const toolResult = await this.mcpService.executeTool(
            toolName,
            toolArgs,
            auth.role,
          );

          resultPayload = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2),
              },
            ],
          };
          break;

        case 'resources/list':
          resultPayload = { resources: [] };
          break;

        case 'prompts/list':
          resultPayload = { prompts: [] };
          break;

        default:
          return res.status(HttpStatus.OK).json({
            jsonrpc: '2.0',
            id: reqId,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          });
      }

      // If SSE session ID exists and connection is open, optionally write message event
      if (sessionId && this.activeSseSessions.has(sessionId)) {
        const session = this.activeSseSessions.get(sessionId);
        if (session && !session.res.writableEnded) {
          const sseData = JSON.stringify({
            jsonrpc: '2.0',
            id: reqId,
            result: resultPayload,
          });
          session.res.write(`event: message\ndata: ${sseData}\n\n`);
        }
      }

      // Always return HTTP 200 JSON-RPC 2.0 response directly for standard compatibility
      return res.status(HttpStatus.OK).json({
        jsonrpc: '2.0',
        id: reqId,
        result: resultPayload,
      });
    } catch (error: any) {
      this.logger.error(`Error processing MCP request method '${method}': ${error.message}`, error.stack);
      return res.status(HttpStatus.OK).json({
        jsonrpc: '2.0',
        id: reqId,
        error: {
          code: -32603,
          message: error.message || 'Internal MCP server error',
        },
      });
    }
  }
}
