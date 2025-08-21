import { OAuthTokenResponse, GitHubUser } from '../types/installation.js';

export class GitHubOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private githubBaseUrl: string;

  constructor() {
    this.clientId = process.env.GITHUB_CLIENT_ID!;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET!;
    this.redirectUri = process.env.GITHUB_REDIRECT_URI!;
    this.githubBaseUrl = process.env.GITHUB_BASE_URL || 'https://github.com';
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo,user:email',
      ...(state && { state })
    });

    return `${this.githubBaseUrl}/login/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    const response = await fetch(`${this.githubBaseUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get user info using access token
   */
  async getUserInfo(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    return response.json();
  }
}
