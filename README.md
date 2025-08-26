# GitHub Code Review Agent

A GitHub App for automated code reviews using Hono.js and Amp.

## Features

- **GitHub App Integration**: Secure GitHub App installation and authentication
- **Webhook Processing**: Automatic pull request event handling
- **Queue Management**: Efficient job queuing and processing
- **Code Review**: AI-powered code analysis and feedback
- **Check Runs**: Integration with GitHub's check runs API for status reporting
- **MCP Server**: Model Context Protocol server for AI agent integration
- **Dashboard**: Web interface for installation management

## Quick Start

1. **Clone and Install**
   ```bash
   cd cra-github
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Install the App**
   - Visit `{APP_BASE_URL}/github/install` (e.g., `https://your-ngrok-url.app/github/install`)
   - Follow the GitHub App installation flow
   - Select repositories to enable code reviews
   - Access dashboard at `{APP_BASE_URL}/github/dashboard/{installationId}`

## Configuration

### GitHub App Setup

1. **Create a GitHub App** in your GitHub settings (`Settings > Developer settings > GitHub Apps`)
2. **Set the following permissions:**
   - Repository: Pull requests (Read & Write)
   - Repository: Checks (Write)
   - Repository: Contents (Read)
   - Repository: Metadata (Read)
3. **Configure webhook settings:**
   - Webhook URL: `https://your-domain.com/github/webhook` (use your CRA_PUBLIC_URL)
   - Subscribe to: Pull request events and Installation events
4. **Generate and download a private key** from the app settings page

### Environment Variables

#### GitHub App Configuration (Required)
```env
# GitHub App ID (found in app settings)
GITHUB_APP_ID=your_github_app_id

# GitHub App name (used in installation URL)
GITHUB_APP_NAME=your-app-name

# GitHub App Client ID and Secret
GITHUB_APP_CLIENT_ID=your_github_app_client_id
GITHUB_APP_CLIENT_SECRET=your_github_app_client_secret

# Private Key Setup (choose one option)
# Option 1: Private key file path
GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem

# Option 2: Private key as environment variable (base64 encoded)
GITHUB_APP_PRIVATE_KEY=your_github_app_private_key_base64_encoded

# Webhook and redirect configuration
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_REDIRECT_URI=http://localhost:5053/github/callback
GITHUB_BASE_URL=https://github.com

# Working directory for the app (used by MCP server)
GITHUB_APP_CWD=/Users/username/project/your-repo
```

#### Public URL Configuration
```env
# Public URL for webhooks (use ngrok or similar for development)
CRA_PUBLIC_URL=https://ngrok-your-url.app
```

#### Server Configuration
```env
# Base URL for the application
APP_BASE_URL=https://ngrok-your-url.app

# Server settings
SERVER_PORT=5053
SERVER_DEBUG=true
```

#### Amp Configuration
```env
# Amp timeout (in seconds)
AMP_TIMEOUT=300

# Amp server URL (use ampcode.com for hosted service)
AMP_SERVER_URL=https://ampcode.com
```

### Private Key Setup

The GitHub App requires a private key for authentication. You have two options:

#### Option 1: File-based (Recommended for development)
1. Download the `.pem` file from your GitHub App settings
2. Place it in your project root as `private-key.pem`
3. Set `GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem`
4. Add `*.pem` to your `.gitignore` to avoid committing the key

#### Option 2: Environment Variable (Recommended for production)
1. Convert your private key to base64:
   ```bash
   cat private-key.pem | base64 -w 0
   ```
2. Set the result as `GITHUB_APP_PRIVATE_KEY` in your environment
3. The application will automatically decode and format the key

**Security Notes:**
- Never commit private keys to version control
- Use secure secret management in production
- Restrict file permissions: `chmod 600 private-key.pem`

### Configuration File (config.yml)

The app uses a `config.yml` file for core configuration including the AI system prompt and tool definitions. This file contains:

#### Key Configuration Sections:
- **GitHub settings**: API endpoints, bot username, check run names
- **Queue configuration**: Worker limits and retry settings
- **Diff processing**: Chunk size limits for large diffs
- **Amp integration**: Command settings and MCP server configuration
- **System prompt**: The complete AI prompt template for code reviews
- **Tool definitions**: Available MCP tools and their usage instructions

#### Important Notes:
- The system prompt in `config.yml` defines how the AI reviews code
- Tool definitions specify which GitHub operations are available to the AI
- Environment variables are interpolated using `${VARIABLE_NAME}` syntax
- Modify the prompt template to customize review behavior and focus areas
- The configuration supports both development and production deployment modes

**Example customization:**
To adjust review focus, modify the `prompt_template` section in `config.yml` to emphasize specific areas like security, performance, or coding standards.

## API Endpoints

### Core Endpoints
- `GET /` - Service information
- `GET /health` - Health check
- `GET /queue/status` - Queue status information
- `GET /jobs/:jobId` - Job status information
- `POST /test/review` - Test endpoint for review functionality

### GitHub App Endpoints
- `POST /github/webhook` - GitHub webhook endpoint
- `GET /github/install` - Start GitHub App installation
- `GET /github/callback` - GitHub App installation callback
- `GET /github/dashboard/:installationId` - Installation dashboard



## Development

### Local Development with ngrok

For development, you'll need to expose your local server to the internet for GitHub webhooks to work:

1. **Install ngrok**: `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)

2. **Start your local server**:
   ```bash
   npm run dev
   ```

3. **Expose with ngrok** (in a separate terminal):
   ```bash
   ngrok http 5053
   ```

4. **Update your environment**:
   - Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
   - Update `CRA_PUBLIC_URL` and `APP_BASE_URL` in your `.env` file
   - Update your GitHub App webhook URL to `{your-ngrok-url}/github/webhook`

### Build
```bash
npm run build
```

### Type Check
```bash
npm run type-check
```

### Lint
```bash
npm run lint
```

### MCP Server
Run the standalone MCP server:
```bash
npm run mcp
```

Or build and run:
```bash
npm run mcp:build
```

## MCP Integration

The app includes a Model Context Protocol (MCP) server that exposes GitHub operations as tools for AI agents and code editors like Cursor.

### Available MCP Tools
- `leave_general_comment` - Leave general comments on pull requests
- `leave_inline_comment` - Leave inline comments on specific lines
- `get_pr_comments` - Get all comments on a pull request

### Usage with AI Agents
The MCP server runs as a standalone stdio server. See [`src/mcp/README.md`](src/mcp/README.md) for detailed configuration and usage instructions.

## Architecture

- **Hono.js**: Fast web framework for the server
- **GitHub API**: Integration with GitHub's REST API
- **GitHub Apps**: Secure app installation and JWT authentication
- **Job Queue**: Background processing for code reviews
- **Amp**: AI-powered code analysis engine
- **MCP Server**: Model Context Protocol server for AI agent integration
- **Installation Management**: Persistent storage for GitHub App installations

## License

MIT License
