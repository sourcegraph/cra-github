import fetch from 'node-fetch';
import { Config } from '../config.js';
import { getInstallationToken, invalidateTokenCache } from './auth.js';

export class GitHubClient {
  private config: Config;
  private baseUrl: string;
  private installationId?: number;

  constructor(config: Config, installationId?: number) {
    this.config = config;
    
    // If no installationId provided, try to get from environment
    if (installationId === undefined) {
      const envId = parseInt(process.env.GITHUB_INSTALLATION_ID || '0', 10);
      this.installationId = envId || undefined;
    } else {
      this.installationId = installationId;
    }
    
    // Validate that we have some form of authentication
    if (!this.installationId && !config.github.token) {
      throw new Error('Missing authentication: set GITHUB_INSTALLATION_ID env var or github.token in config.yml');
    }
    
    const githubConfig = config.github;
    this.baseUrl = (githubConfig.base_url ?? 'https://api.github.com').replace(/\/$/, '');
  }

  static forInstallation(config: Config, installationId: number): GitHubClient {
    return new GitHubClient(config, installationId);
  }

  static fromEnv(config: Config): GitHubClient {
    return new GitHubClient(config);
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (this.installationId) {
      try {
        const token = await getInstallationToken(this.installationId);
        return {
          ...headers,
          'Authorization': `Bearer ${token}`,
        };
      } catch (error) {
        console.error('❌ Failed to get installation token:', error);
        throw error;
      }
    } else {
      // Fallback to static token
      return {
        ...headers,
        'Authorization': `token ${this.config.github.token}`,
      };
    }
  }

  private async makeRequest(url: string, options: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    
    // Add Content-Type for requests with body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers ?? {}),
      },
    });

    // Handle 401 by invalidating cache and retrying once
    if (response.status === 401 && this.installationId) {
      invalidateTokenCache(this.installationId);
      const retryHeaders = await this.getAuthHeaders();
      
      // Add Content-Type for requests with body
      if (options.body) {
        retryHeaders['Content-Type'] = 'application/json';
      }
      
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...retryHeaders,
          ...(options.headers ?? {}),
        },
      });
      return retryResponse;
    }

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
      actions?: Array<{
        label: string;
        description: string;
        identifier: string;
      }>;
    }
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/check-runs`;
    
    const payload = {
      name: options.name,
      head_sha: headSha,
      status: options.status || 'queued',
      ...(options.conclusion && { conclusion: options.conclusion }),
      ...(options.output && { output: options.output }),
      ...(options.details_url && { details_url: options.details_url }),
      ...(options.actions && { actions: options.actions }),
    };

    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
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
      actions?: Array<{
        label: string;
        description: string;
        identifier: string;
      }>;
    }
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/check-runs/${checkRunId}`;
    
    const response = await this.makeRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async createPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    
    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
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

    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getPRDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.text();
  }

  async getPRInfo(owner: string, repo: string, prNumber: number): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getRepositoryInfo(owner: string, repo: string): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getPRComments(owner: string, repo: string, prNumber: number): Promise<any[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }
}
