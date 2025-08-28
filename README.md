# GitHub Code Review Agent

A GitHub App for automated code reviews using Hono.js and Amp.

## Features

- **GitHub App Integration**: Secure GitHub App installation and authentication
- **Webhook Processing**: Automatic pull request event handling
- **Queue Management**: Efficient job queuing and processing
- **Code Review**: AI-powered code analysis and feedback
- **Check Runs**: Integration with GitHub's check runs API for status reporting
- **MCP Server**: Model Context Protocol server for AI agent integration

**Requirements**: Amp account with API key required for code reviews.

## Quick Start

### Local Development

1. **Clone and Install**
   ```bash
   cd cra-github
   pnpm install
   ```

2. **Build (required for MCP server)**
   ```bash
   pnpm run build
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

4. **Start Development Server**
   ```bash
   pnpm run dev
   ```

### Docker Setup

1. **Create GitHub App**
   - Go to GitHub Settings > Developer settings > GitHub Apps > New GitHub App
   - Set webhook URL to placeholder (e.g., `https://example.com/webhook`)
   - Download private key, note App ID and webhook secret

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Fill in GitHub App credentials from step 1
   # For Docker, use GITHUB_APP_PRIVATE_KEY (base64) instead of file path:
   # cat private-key.pem | base64 -w 0
   ```

3. **Start Container**
   ```bash
   docker compose up --build
   # or with Podman: podman-compose up --build
   ```

4. **Update Webhook URL**
   - For local dev: start ngrok (`ngrok http 5053`)
   - Update GitHub App webhook URL to `https://your-url/github/webhook`

5. **Install the App**
   - Visit `http://localhost:5053/github/install`
   - Select repositories to enable code reviews

## Configuration

### GitHub App Setup

1. **Create a GitHub App** in your GitHub settings (`Settings > Developer settings > GitHub Apps`)
2. **Set the following permissions:**
   - Repository: Pull requests (Read & Write)
   - Repository: Checks (Write)
   - Repository: Contents (Read)
   - Repository: Metadata (Read)
   - Repository: Webhooks (Write)
3. **Configure webhook settings:**
   - Webhook URL: `https://your-domain.com/github/webhook` (use your APP_BASE_URL)
   - Subscribe to: Pull request events and Installation events
4. **Generate and download a private key** from the app settings page

### Environment Variables

Copy `.env.example` to `.env` and configure the required values.

### Private Key Setup

The GitHub App requires a private key for authentication. You have two options:

#### Option 1: File-based (Recommended for development)
1. Download the `.pem` file from your GitHub App settings
2. Place it in your project root as `private-key.pem`
3. Set `GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem`
4. Add `*.pem` to your `.gitignore` to avoid committing the key

#### Option 2: Environment Variable (Recommended for production/Docker)
1. Convert your private key to base64:
   ```bash
   cat private-key.pem | base64 -w 0
   ```
2. Set the result as `GITHUB_APP_PRIVATE_KEY` in your environment
3. The application will automatically decode and format the key

**Note**: Docker setup requires the base64 encoded key in `.env` - private key files are not accessible in containers.

### Configuration File (config.yml)

Contains GitHub settings, queue configuration, server settings, Amp integration, and the AI review prompt. Environment variables are interpolated using `${VARIABLE_NAME}` syntax.

To customize review behavior, modify the `prompt_template` section.

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check
- `GET /queue/status` - Queue status information  
- `GET /jobs/:jobId` - Job status information
- `POST /github/webhook` - GitHub webhook endpoint
- `GET /github/install` - Start GitHub App installation
- `GET /github/callback` - GitHub App installation callback


## Development

### Local Development with ngrok

For development, you'll need to expose your local server to the internet for GitHub webhooks to work:

1. **Install ngrok**: `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)

2. **Start your local server**:
   ```bash
   pnpm run dev
   ```

3. **Expose with ngrok** (in a separate terminal):
   ```bash
   ngrok http 5053
   ```

4. **Update your environment**:
   - Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
   - Update `APP_BASE_URL` in your `.env` file
   - Update your GitHub App webhook URL to `{your-ngrok-url}/github/webhook`

### Build
```bash
pnpm run build
```

### Type Check
```bash
pnpm run type-check
```

### Lint
```bash
pnpm run lint
```

### MCP Server
Run the standalone MCP server:
```bash
pnpm run mcp
```

Or build and run:
```bash
pnpm run mcp:build
```

## MCP Integration

The app includes a Model Context Protocol (MCP) server that exposes GitHub operations as tools for Amp Agent. See [`src/mcp/README.md`](src/mcp/README.md) for details.

## Architecture

- **Hono.js**: Fast web framework for the server
- **GitHub API**: Integration with GitHub's REST API
- **GitHub Apps**: Secure app installation and JWT authentication
- **Job Queue**: Background processing for code reviews
- **Amp**: AI-powered code analysis engine
- **MCP Server**: Model Context Protocol server for AI agent integration

## License

MIT License
