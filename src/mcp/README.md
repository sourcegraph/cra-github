# GitHub MCP Server

This directory contains the Model Context Protocol (MCP) server implementation for GitHub integration. The server exposes GitHub operations as tools that can be used by the Amp Agent.

## Available Tools

### 1. `leave_general_comment`
Leave general comments on pull requests.

### 2. `leave_inline_comment`
Leave inline comments on specific lines in pull requests. Supports optional `suggested_fix` parameter for code suggestions.

### 3. `get_pr_comments`
Get all comments on a pull request.

## Usage

### STDIO Server

Run the standalone MCP server for direct stdio communication:

```bash
pnpm run mcp
```

Or build and run:
```bash
pnpm run mcp:build
```

## Configuration

Uses the same configuration as the main application. Requires GitHub App credentials for authentication.

## Integration with AI Agents

### Amp Integration

The MCP server is automatically configured for use with Amp in `config.yml`:

```yaml
amp:
  settings:
    amp.mcpServers:
      github:
        command: "sh"
        args: ["-c", "cd ${GITHUB_APP_CWD} && node dist/mcp/server.js"]
        env:
          GITHUB_APP_CWD: "${GITHUB_APP_CWD}"
          GITHUB_APP_ID: "${GITHUB_APP_ID}"
          GITHUB_APP_PRIVATE_KEY_PATH: "${GITHUB_APP_PRIVATE_KEY_PATH}"
```

This allows Amp to automatically use the GitHub MCP tools during code reviews.

### Code Review Workflow

1. **Check Existing Feedback**: `get_pr_comments` to see what's already been discussed
2. **Leave Feedback**: 
   - `leave_inline_comment` for specific line-level issues
   - `leave_general_comment` for overall observations

## Development

The tools are organized in the `/src/mcp/tools/` directory:
- `leave_general_comment.ts` - General comment functionality
- `leave_inline_comment.ts` - Inline comment functionality
- `get_pr_comments.ts` - PR comments retrieval

The server implementation is:
- `server.ts` - Standalone stdio MCP server
