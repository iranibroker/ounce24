export type McpRole = 'admin' | 'analyst';

export interface McpAuthResult {
  authorized: boolean;
  role: McpRole;
}
