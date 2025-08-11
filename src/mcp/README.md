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

### 3. `create_check_run`
Create or update check run status.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `commit_sha` (string, required): Commit SHA to create check run for
- `status` (string, required): Check run status - "queued", "in_progress", or "completed"
- `conclusion` (string, optional): Check run conclusion - "success", "failure", "neutral", "cancelled", "skipped", or "timed_out"
- `title` (string, optional): Check run title
- `summary` (string, optional): Check run summary
- `details_url` (string, optional): Details URL for the check run

### 4. `get_pr_info`
Get pull request details and optionally the diff.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pr_number` (number, required): Pull request number
- `include_diff` (boolean, optional): Include diff content (default: false)

### 5. `trigger_review`
Start the code review process.

**Parameters:**
- `owner` (string, required): Repository owner
- `repo` (string, required): Repository name
- `pr_number` (number, required): Pull request number
- `commit_sha` (string, optional): Specific commit SHA to review
- `force` (boolean, optional): Force re-review even if already reviewed (default: false)

### 6. `get_pr_comments`
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

- `GITHUB_BASE_URL` - GitHub API URL (default: https://api.github.com)
- `GITHUB_TOKEN` - GitHub access token
- `MCP_AUTH_TOKEN` - Token for MCP server authentication (optional)

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

### Example Usage in Prompts

```
You have access to GitHub tools. To review a pull request:

1. Use get_pr_info to understand the context
2. Review the code changes  
3. Use leave_inline_comment to add specific feedback
4. Use create_check_run to mark the review complete

Owner: octocat
Repo: Hello-World
PR Number: 123
```

## Development

The tools are organized in the `/src/mcp/tools/` directory:
- `leave_comment.ts` - General comment functionality
- `leave_inline_comment.ts` - Inline comment functionality
- `create_check_run.ts` - Check run status updates
- `get_pr_info.ts` - PR information retrieval  
- `get_pr_comments.ts` - PR comments retrieval
- `trigger_review.ts` - Review triggering

The server implementations are:
- `server.ts` - Standalone stdio MCP server
- `http-server.ts` - HTTP adapter for mcp-remote
