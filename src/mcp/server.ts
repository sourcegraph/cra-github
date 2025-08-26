import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Load environment variables
config();
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig, Config } from '../config.js';
import { leaveGeneralComment } from './tools/leave_comment.js';
import { leaveInlineComment } from './tools/leave_inline_comment.js';
import { getPRComments } from './tools/get_pr_comments.js';
import {
  validateLeaveGeneralCommentArgs,
  validateLeaveInlineCommentArgs,
  validateGetPRCommentsArgs
} from './validation.js';

class GitHubMCPServer {
  private server: Server;
  private config: Config;

  constructor() {
    console.log('🚀 Initializing GitHub MCP Server...');
    this.server = new Server(
      {
        name: 'github-cra',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = getConfig();
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    console.log('🔨 Setting up tool handlers...');
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('📋 ListTools request received - returning available tools');
      return {
        tools: [
          {
            name: 'leave_general_comment',
            description: 'Leave general comments on pull requests',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The comment message',
                },
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pr_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
              },
              required: ['message', 'owner', 'repo', 'pr_number'],
            },
          },
          {
            name: 'leave_inline_comment',
            description: 'Leave inline comments on specific lines in pull requests',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The comment message',
                },
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pr_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
                path: {
                  type: 'string',
                  description: 'File path for the inline comment',
                },
                line: {
                  type: 'number',
                  description: 'Line number for the inline comment',
                },
                commit_sha: {
                  type: 'string',
                  description: 'Commit SHA (optional - will be fetched if not provided)',
                },
              },
              required: ['message', 'owner', 'repo', 'pr_number', 'path', 'line'],
            },
          },
          {
            name: 'get_pr_comments',
            description: 'Get all comments on a pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pr_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
              },
              required: ['owner', 'repo', 'pr_number'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`🔧 MCP Tool called: ${name}`);
      console.log(`📝 Tool arguments:`, JSON.stringify(args, null, 2));
      const startTime = Date.now();

      try {
        switch (name) {
          case 'leave_general_comment': {
            console.log(`🗨️  Executing leave_general_comment...`);
            const validatedArgs = validateLeaveGeneralCommentArgs(args);
            const result = await leaveGeneralComment(validatedArgs);
            console.log(`✅ leave_general_comment completed in ${Date.now() - startTime}ms`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'leave_inline_comment': {
            console.log(`📝 Executing leave_inline_comment...`);
            const validatedArgs = validateLeaveInlineCommentArgs(args);
            const result = await leaveInlineComment(validatedArgs);
            console.log(`✅ leave_inline_comment completed in ${Date.now() - startTime}ms`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }


          case 'get_pr_comments': {
            console.log(`💬 Executing get_pr_comments...`);
            const validatedArgs = validateGetPRCommentsArgs(args);
            const result = await getPRComments(
              validatedArgs,
              this.config
            );
            console.log(`✅ get_pr_comments completed in ${Date.now() - startTime}ms`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            console.log(`❌ Unknown tool requested: ${name}`);
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.log(`❌ Tool execution failed for ${name} after ${Date.now() - startTime}ms:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  async run(): Promise<void> {
    console.log('🔌 Starting MCP server connection...');
    console.log('📡 Creating stdio transport...');
    const transport = new StdioServerTransport();
    console.log('🔗 Connecting to transport...');
    await this.server.connect(transport);
    console.error('🟢 GitHub MCP server running on stdio - ready to receive requests');
  }
}

// Run the server
const server = new GitHubMCPServer();
server.run().catch(console.error);
