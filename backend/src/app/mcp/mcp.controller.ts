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

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);
  private activeSseSessions = new Map<string, Response>();

  constructor(private readonly mcpService: McpService) {}

  // Dual Transport: SSE stream endpoint or Non-SSE health check
  @Get()
  @Get('sse')
  handleGet(@Req() req: Request, @Res() res: Response) {
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

      this.activeSseSessions.set(sessionId, res);

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

    // Flexible Authentication Check
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

    const expectedKey = process.env.MCP_API_KEY;
    if (expectedKey && providedKey !== expectedKey) {
      this.logger.warn(`Unauthorized MCP request attempt from ${req.ip}`);
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
            },
          };
          break;

        case 'ping':
          resultPayload = {};
          break;

        case 'tools/list':
          resultPayload = {
            tools: this.mcpService.getToolsList(),
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
      const sessionId = req.query.sessionId as string;
      if (sessionId && this.activeSseSessions.has(sessionId)) {
        const sseRes = this.activeSseSessions.get(sessionId);
        if (sseRes && !sseRes.writableEnded) {
          const sseData = JSON.stringify({
            jsonrpc: '2.0',
            id: reqId,
            result: resultPayload,
          });
          sseRes.write(`event: message\ndata: ${sseData}\n\n`);
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
