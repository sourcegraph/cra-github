import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { Config } from '../config.js';
import { GitHubOAuthService } from './oauth.js';
import { InstallationStore } from './installation-store.js';
import { GitHubInstallation } from '../types/installation.js';

export class GitHubClient {
  private config: Config;
  private baseUrl: string;
  private token: string;
  private headers: Record<string, string>;
  private oauthService?: GitHubOAuthService;
  private installationStore?: InstallationStore;
  private installation?: GitHubInstallation;
  private useAppAuth: boolean;
  private installationId?: string;

  constructor(
    config: Config, 
    installation?: GitHubInstallation,
    oauthService?: GitHubOAuthService,
    installationStore?: InstallationStore
  ) {
    this.config = config;
    const githubConfig = config.github;
    this.baseUrl = githubConfig.base_url.replace(/\/$/, '');
    this.installation = installation;
    this.oauthService = oauthService;
    this.installationStore = installationStore;
    
    this.useAppAuth = !!(process.env.GITHUB_APP_ID && (process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY_PATH));
    this.installationId = installation?.githubInstallationId?.toString();
        
    if (this.useAppAuth && this.installationId) {
      // Will get token dynamically for app auth
      this.token = '';
      this.headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      };
    } else {
      // Use static token from config
      this.token = githubConfig.token;
      this.headers = {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      };
    }
  }

  private async generateAppToken(): Promise<string> {
    if (!process.env.GITHUB_APP_ID) {
      throw new Error('GITHUB_APP_ID environment variable is required');
    }
    
    // Read private key from environment
    let privateKey: string;
    
    if (process.env.GITHUB_APP_PRIVATE_KEY) {
      const rawKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      // Check if the key is base64 encoded
      if (!rawKey.includes('-----BEGIN') && /^[A-Za-z0-9+/]+=*$/.test(rawKey.replace(/\s/g, ''))) {
        try {
          privateKey = Buffer.from(rawKey, 'base64').toString('utf8');
        } catch (error) {
          throw new Error(`Failed to decode base64 private key: ${error}`);
        }
      } else {
        privateKey = rawKey;
      }
    } else {
      // Read from file
      const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || 'private-key.pem';
      try {
        privateKey = readFileSync(keyPath, 'utf8');
      } catch (error) {
        throw new Error(`Failed to read private key file at ${keyPath}: ${error}`);
      }
    }

    // Auto-format private key if it's missing PEM headers
    if (!privateKey.includes('-----BEGIN')) {
      const base64Content = privateKey
        .replace(/\s/g, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .trim();
      
      if (!/^[A-Za-z0-9+/]+=*$/.test(base64Content)) {
        throw new Error('Private key content does not appear to be valid base64');
      }
      
      const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
      privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`;
    }
    
    const payload = {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + (10 * 60),
      iss: process.env.GITHUB_APP_ID,
    };
    
    try {
      return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    } catch (error) {
      throw new Error(`Failed to sign JWT: ${error}`);
    }
  }

  private async getInstallationAccessToken(installationId: string, appToken: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Amp-Code-Review-Agent/1.0',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get installation access token: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as { token: string };
    return data.token;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.useAppAuth && this.installationId) {
      try {
        const appToken = await this.generateAppToken();
        console.log('  ✅ App token generated successfully');
        
        const installationToken = await this.getInstallationAccessToken(this.installationId, appToken);
        console.log('  ✅ Installation token obtained successfully');
        
        return {
          ...this.headers,
          'Authorization': `Bearer ${installationToken}`,
        };
      } catch (error) {
        console.error('❌ Failed to get app authentication token:', error);
        throw error;
      }
    }
    
    console.log('🔑 Using static token authentication');
    return this.headers;
  }

  private async makeRequest(url: string, options: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    return response;
  }

  async createCheckRun(
    owner: string,
    repo: string,
    headSha: string,
    options: {
      name: string;
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
      output?: {
        title: string;
        summary: string;
        text?: string;
      };
      details_url?: string;
    }
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/check-runs`;
    
    console.log('Creating check run with token length:', this.config.github.token.length);
    
    const payload = {
      name: options.name,
      head_sha: headSha,
      status: options.status || 'queued',
      ...(options.conclusion && { conclusion: options.conclusion }),
      ...(options.output && { output: options.output }),
      ...(options.details_url && { details_url: options.details_url }),
    };

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to create check run: ${error}`);
      throw error;
    }
  }

  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    options: {
      status?: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
      output?: {
        title: string;
        summary: string;
        text?: string;
      };
      details_url?: string;
    }
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/check-runs/${checkRunId}`;
    
    try {
      const response = await this.makeRequest(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to update check run: ${error}`);
      throw error;
    }
  }

  async createPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    
    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to post PR comment: ${error}`);
      throw error;
    }
  }

  async createPRReview(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT',
    comments?: Array<{
      path: string;
      line: number;
      body: string;
    }>
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
    
    const payload: any = {
      body,
      event,
    };

    if (comments && comments.length > 0) {
      payload.comments = comments;
    }

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to create PR review: ${error}`);
      throw error;
    }
  }

  async getPRDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          ...this.headers,
          'Accept': 'application/vnd.github.v3.diff',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Failed to get PR diff: ${error}`);
      throw error;
    }
  }

  async getPRInfo(owner: string, repo: string, prNumber: number): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get PR info: ${error}`);
      throw error;
    }
  }

  async getRepositoryInfo(owner: string, repo: string): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get repository info: ${error}`);
      throw error;
    }
  }

  async getPRComments(owner: string, repo: string, prNumber: number): Promise<any[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get PR comments: ${error}`);
      throw error;
    }
  }
}
