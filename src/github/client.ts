import fetch from 'node-fetch';
import { minimatch } from 'minimatch';
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

  static create(config: Config, options?: { installationId?: number; token?: string }): GitHubClient {
    if (options?.token) {
      const configWithToken = {
        ...config,
        github: {
          ...config.github,
          token: options.token
        }
      };
      return new GitHubClient(configWithToken);
    }
    
    if (options?.installationId) {
      return new GitHubClient(config, options.installationId);
    }
    
    // Auto-detect from environment (GITHUB_INSTALLATION_ID)
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
        console.error('Failed to get installation token:', error);
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

  private addContentTypeHeader(headers: Record<string, string>, options: any): void {
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
  }

  private async makeRequest(url: string, options: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    this.addContentTypeHeader(headers, options);
    
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
      this.addContentTypeHeader(retryHeaders, options);
      
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

  private async handleResponse(response: Response, expectJson = true): Promise<any> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return expectJson ? await response.json() : await response.text();
  }

  private async checkResponseError(response: Response, context?: string): Promise<void> {
    if (!response.ok) {
      const errorText = await response.text();
      const prefix = context ? `${context}: ` : 'GitHub API error: ';
      throw new Error(`${prefix}${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  private buildRepoUrl(owner: string, repo: string, path = ''): string {
    return `${this.baseUrl}/repos/${owner}/${repo}${path ? `/${path}` : ''}`;
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
    const url = this.buildRepoUrl(owner, repo, 'check-runs');
    
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

    return await this.handleResponse(response);
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
    const url = this.buildRepoUrl(owner, repo, `check-runs/${checkRunId}`);
    
    const response = await this.makeRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(options),
    });

    return await this.handleResponse(response);
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
    const url = this.buildRepoUrl(owner, repo, `pulls/${prNumber}/reviews`);
    
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

    return await this.handleResponse(response);
  }


  async getPRInfo(owner: string, repo: string, prNumber: number): Promise<any> {
    const url = this.buildRepoUrl(owner, repo, `pulls/${prNumber}`);
    
    const response = await this.makeRequest(url, {
      method: 'GET',
    });

    return await this.handleResponse(response);
  }


  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<any[]> {
    const url = this.buildRepoUrl(owner, repo, `pulls/${prNumber}/files`);
    
    const response = await this.makeRequest(url, {
      method: 'GET',
    });

    return await this.handleResponse(response);
  }

  async getFilteredPRDiff(
    owner: string, 
    repo: string, 
    prNumber: number, 
    fileFilter?: (filename: string) => boolean
  ): Promise<string> {
    const files = await this.getPRFiles(owner, repo, prNumber);
    
    let filteredFiles = files;
    
    // Apply config-based ignore patterns
    const ignorePatterns = this.config.reviewer?.ignore;
    if (ignorePatterns && ignorePatterns.length > 0) {
      filteredFiles = filteredFiles.filter(file => 
        !ignorePatterns.some(pattern => minimatch(file.filename, pattern))
      );
    }
    
    // Apply custom filter if provided
    if (fileFilter) {
      filteredFiles = filteredFiles.filter(file => fileFilter(file.filename));
    }
    
    // Combine patches from filtered files with proper diff headers
    return filteredFiles.map(file => {
      if (!file.patch) return '';
      
      // Add proper diff header if not present
      const patch = file.patch;
      if (!patch.startsWith('diff --git')) {
        return `diff --git a/${file.filename} b/${file.filename}\nindex ${file.sha?.substring(0,7) || 'unknown'}..${file.sha?.substring(0,7) || 'unknown'} 100644\n--- a/${file.filename}\n+++ b/${file.filename}\n${patch}`;
      }
      return patch;
    }).join('\n\n');
  }

  async getPRComments(owner: string, repo: string, prNumber: number): Promise<any[]> {
    // Fetch both issue comments (general discussion) and review comments (inline code comments)
    const [issueCommentsResponse, reviewCommentsResponse] = await Promise.all([
      // General PR discussion comments
      this.makeRequest(this.buildRepoUrl(owner, repo, `issues/${prNumber}/comments`), {
        method: 'GET',
      }),
      // Inline code review comments  
      this.makeRequest(this.buildRepoUrl(owner, repo, `pulls/${prNumber}/comments`), {
        method: 'GET',
      })
    ]);

    await this.checkResponseError(issueCommentsResponse, 'GitHub API error (issue comments)');
    await this.checkResponseError(reviewCommentsResponse, 'GitHub API error (review comments)');

    const issueComments = await issueCommentsResponse.json();
    const reviewComments = await reviewCommentsResponse.json();

    // Combine both types with a type indicator
    const allComments = [
      ...issueComments.map((comment: any) => ({ ...comment, comment_type: 'issue' })),
      ...reviewComments.map((comment: any) => ({ ...comment, comment_type: 'review' }))
    ];

    // Sort by creation date
    return allComments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}
