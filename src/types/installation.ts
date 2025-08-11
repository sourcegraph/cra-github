export interface GitHubInstallation {
  id: string;
  githubInstallationId: number; // GitHub App installation ID
  githubUserId: number;
  githubUsername: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  installedAt: Date;
  lastUsed?: Date;
  webhookId?: number;
  repositoryId?: number;
  organizationId?: number;
  repositories?: {
    id: number;
    name: string;
    full_name: string;
  }[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}
