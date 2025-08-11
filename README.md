# GitHub Code Review Agent

A GitHub App for automated code reviews using Hono.js and Amp.

## Features

- **GitHub App Integration**: Secure GitHub App installation and authentication
- **Webhook Processing**: Automatic pull request event handling
- **Queue Management**: Efficient job queuing and processing
- **Code Review**: AI-powered code analysis and feedback
- **Check Runs**: Integration with GitHub's check runs API for status reporting

## Quick Start

1. **Clone and Install**
   ```bash
   cd cra-github
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub app credentials
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Install the App**
   - Visit `http://localhost:5053/github/install`
   - Follow the GitHub App installation flow
   - Select repositories to enable code reviews

## Configuration

### GitHub App Setup

1. **Create a GitHub App** in your GitHub settings (`Settings > Developer settings > GitHub Apps`)
2. **Set the following permissions:**
   - Repository: Pull requests (Read & Write)
   - Repository: Checks (Write)
   - Repository: Contents (Read)
   - Repository: Metadata (Read)
3. **Configure webhook settings:**
   - Webhook URL: `https://your-domain.com/github/webhook`
   - Subscribe to: Pull request events
4. **Generate and download a private key** from the app settings page

### Environment Variables

#### GitHub App Configuration (Required)
```env
# GitHub App ID (found in app settings)
GITHUB_APP_ID=123456

# GitHub App name (used in installation URL)
GITHUB_APP_NAME=your-app-name

# GitHub App Client ID and Secret
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your_app_client_secret

# Private Key Setup (choose one option)
# Option 1: Private key file path
GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem

# Option 2: Private key as environment variable (base64 encoded)
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTi...your_base64_encoded_key

# Webhook secret (optional but recommended)
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

#### Server Configuration
```env
# Server settings
PORT=5053
DEBUG=true
APP_BASE_URL=http://localhost:5053

# Amp Configuration
AMP_TIMEOUT=60000
AMP_SERVER_URL=ws://localhost:3001
AMP_URL=http://localhost:3001
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

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check
- `POST /github/webhook` - GitHub webhook endpoint
- `GET /github/install` - Start GitHub App installation
- `GET /github/callback` - GitHub App installation callback
- `GET /github/dashboard/:installationId` - Installation dashboard
- `GET /queue/status` - Queue status information

## Development

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

## Architecture

- **Hono.js**: Fast web framework for the server
- **GitHub API**: Integration with GitHub's REST API
- **GitHub Apps**: Secure app installation and JWT authentication
- **Job Queue**: Background processing for code reviews
- **Amp**: AI-powered code analysis engine

## License

MIT License
