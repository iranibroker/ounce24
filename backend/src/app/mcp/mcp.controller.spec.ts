import { Test, TestingModule } from '@nestjs/testing';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { HttpStatus } from '@nestjs/common';

describe('McpController and Role-Based Sanitization', () => {
  let controller: McpController;
  let mockMcpService: any;

  const originalApiKey = process.env.MCP_API_KEY;
  const originalAnalystKey = process.env.MCP_ANALYST_API_KEY;

  beforeAll(() => {
    process.env.MCP_API_KEY = 'admin_secret_token';
    process.env.MCP_ANALYST_API_KEY = 'analyst_limited_token';
  });

  afterAll(() => {
    process.env.MCP_API_KEY = originalApiKey;
    process.env.MCP_ANALYST_API_KEY = originalAnalystKey;
  });

  beforeEach(async () => {
    mockMcpService = {
      getToolsList: jest.fn((role) => {
        const allTools = [
          { name: 'get_database_summary' },
          { name: 'get_users_list' },
          { name: 'get_signals_list' },
          { name: 'query_collection_raw' },
        ];
        if (role === 'analyst') {
          return allTools.filter((t) => t.name !== 'query_collection_raw');
        }
        return allTools;
      }),
      executeTool: jest.fn(async (name, args, role) => {
        if (role === 'analyst' && name === 'query_collection_raw') {
          throw new Error('Access denied: query_collection_raw is restricted to admin tokens');
        }
        if (name === 'get_users_list') {
          if (role === 'analyst') {
            return {
              users: [
                {
                  id: 'u123',
                  name: 'Trader_u123',
                  totalScore: 100,
                  winRate: 85,
                  registrationSource: 'telegram',
                },
              ],
            };
          }
          return {
            users: [
              {
                id: 'u123',
                name: 'Ali Reza',
                phone: '09121234567',
                telegramId: '123456',
                telegramUsername: 'alireza_trader',
                email: 'ali@example.com',
                totalScore: 100,
                winRate: 85,
              },
            ],
          };
        }
        return { success: true };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        {
          provide: McpService,
          useValue: mockMcpService,
        },
      ],
    }).compile();

    controller = module.get<McpController>(McpController);
  });

  it('should reject unauthorized requests when invalid key is provided', async () => {
    const mockReq: any = {
      headers: { authorization: 'Bearer wrong_token' },
      query: {},
      ip: '127.0.0.1',
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.handlePost(mockReq, mockRes);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: -32001,
          message: expect.stringContaining('Unauthorized'),
        }),
      }),
    );
  });

  it('should authenticate admin token and provide all tools including raw queries', async () => {
    const mockReq: any = {
      headers: { authorization: 'Bearer admin_secret_token' },
      query: {},
      body: { id: 1, method: 'tools/list' },
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.handlePost(mockReq, mockRes);
    expect(mockMcpService.getToolsList).toHaveBeenCalledWith('admin');
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          tools: expect.arrayContaining([{ name: 'query_collection_raw' }]),
        }),
      }),
    );
  });

  it('should authenticate analyst token and exclude query_collection_raw', async () => {
    const mockReq: any = {
      headers: { authorization: 'Bearer analyst_limited_token' },
      query: {},
      body: { id: 2, method: 'tools/list' },
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.handlePost(mockReq, mockRes);
    expect(mockMcpService.getToolsList).toHaveBeenCalledWith('analyst');
    const resultCall = mockRes.json.mock.calls[0][0];
    const toolNames = resultCall.result.tools.map((t: any) => t.name);
    expect(toolNames).not.toContain('query_collection_raw');
    expect(toolNames).toContain('get_users_list');
  });

  it('should block analyst token from executing query_collection_raw', async () => {
    const mockReq: any = {
      headers: { authorization: 'Bearer analyst_limited_token' },
      query: {},
      body: {
        id: 3,
        method: 'tools/call',
        params: { name: 'query_collection_raw', arguments: { collectionName: 'users' } },
      },
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.handlePost(mockReq, mockRes);
    const resultCall = mockRes.json.mock.calls[0][0];
    expect(resultCall.error.code).toBe(-32603);
    expect(resultCall.error.message).toContain('Access denied');
  });

  it('should return sanitized user data without phone/telegram when called with analyst token', async () => {
    const mockReq: any = {
      headers: { authorization: 'Bearer analyst_limited_token' },
      query: {},
      body: {
        id: 4,
        method: 'tools/call',
        params: { name: 'get_users_list', arguments: {} },
      },
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.handlePost(mockReq, mockRes);
    const resultCall = mockRes.json.mock.calls[0][0];
    const parsedContent = JSON.parse(resultCall.result.content[0].text);
    const user = parsedContent.users[0];

    expect(user.phone).toBeUndefined();
    expect(user.telegramId).toBeUndefined();
    expect(user.telegramUsername).toBeUndefined();
    expect(user.email).toBeUndefined();
    expect(user.totalScore).toBe(100);
    expect(user.winRate).toBe(85);
  });
});
