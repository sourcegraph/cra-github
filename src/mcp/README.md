# GitHub MCP Server

This directory contains the Model Context Protocol (MCP) server implementation for GitHub integration. The server exposes GitHub operations as tools that can be used by AI agents and code editors like Cursor.

## Available Tools

### 1. `leave_general_comment`
Leave general comments on pull requests.

**Parameters:**
- `message` (string, required): The comment message
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pr_number` (number, required): Pull request number

### 2. `leave_inline_comment`
Leave inline comments on specific lines in pull requests.

**Parameters:**
- `message` (string, required): The comment message
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pr_number` (number, required): Pull request number
- `path` (string, required): File path for the inline comment
- `line` (number, required): Line number for the inline comment
- `commit_sha` (string, optional): Commit SHA (will be fetched if not provided)

### 3. `get_pr_comments`
Get all comments on a pull request.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pr_number` (number, required): Pull request number

## Usage

### HTTP Server (for mcp-remote)

The MCP server is exposed via HTTP endpoints at `/mcp` when the main server is running.

**Endpoints:**
- `GET /mcp/tools/list` - List available tools
- `POST /mcp/tools/call` - Call a tool
- `GET /mcp/health` - Health check

**Authentication:**
Set the `MCP_AUTH_TOKEN` environment variable and include it in requests:
```
Authorization: Bearer <your-token>
```

**Usage with mcp-remote:**
```bash
npx mcp-remote http://localhost:5053/mcp --header "Authorization: Bearer your-token"
```

### Standalone STDIO Server

Run the standalone MCP server for direct stdio communication:

```bash
npm run mcp
```

Or build and run:
```bash
npm run mcp:build
```

## Configuration

The server uses the same configuration as the main application. Make sure your `config.yml` and environment variables are properly set:

### Environment Variables
- `GITHUB_APP_ID` - GitHub App ID
- `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_PATH` - GitHub App private key
- `GITHUB_BASE_URL` - GitHub API URL (default: https://api.github.com)
- `MCP_AUTH_TOKEN` - Token for MCP server authentication (optional)

### GitHub App Integration
The MCP server works with GitHub App installations for authentication. When accessing repositories, it uses the GitHub App's installation tokens rather than personal access tokens.

## Integration with AI Agents

### Cursor Configuration

Add to your Cursor settings:

```json
{
  "mcp.servers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote", 
        "http://localhost:5053/mcp",
        "--header",
        "Authorization: Bearer your-mcp-token"
      ]
    }
  }
}
```

### Amp Integration

The MCP server is automatically configured for use with Amp in `config.yml`:

```yaml
amp:
  settings:
    amp.mcpServers:
      github:
        command: "sh"
        args: ["-c", "cd ${GITHUB_APP_CWD} && pnpm run mcp"]
        env:
          GITHUB_APP_CWD: "${GITHUB_APP_CWD}"
          GITHUB_APP_ID: "${GITHUB_APP_ID}"
          GITHUB_APP_PRIVATE_KEY_PATH: "${GITHUB_APP_PRIVATE_KEY_PATH}"
```

This allows Amp to automatically use the GitHub MCP tools during code reviews.

### Example Usage in Prompts

```
You have access to GitHub tools. To review a pull request:

1. Use get_pr_comments to see existing feedback
2. Review the code changes  
3. Use leave_inline_comment to add specific feedback
4. Use leave_general_comment for overall observations

Owner: octocat
Repo: Hello-World
PR Number: 123
```

### Code Review Workflow

The tools are designed to work together in a typical code review workflow:

1. **Check Existing Feedback**: `get_pr_comments` to see what's already been discussed
2. **Leave Feedback**: 
   - `leave_inline_comment` for specific line-level issues
   - `leave_general_comment` for overall observations

## Development

The tools are organized in the `/src/mcp/tools/` directory:
- `leave_comment.ts` - General comment functionality
- `leave_inline_comment.ts` - Inline comment functionality
- `get_pr_comments.ts` - PR comments retrieval

The server implementations are:
- `server.ts` - Standalone stdio MCP server
- `http-server.ts` - HTTP adapter for mcp-remote
