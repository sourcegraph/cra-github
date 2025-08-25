import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface CreateCheckRunArgs {
  owner: string;
  repo: string;
  commit_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
  title?: string;
  summary?: string;
  details_url?: string;
}

export async function createCheckRun(
  args: CreateCheckRunArgs,
  config: Config
): Promise<{ success: boolean; check_run_id?: number; error?: string }> {
  try {
    const { owner, repo, commit_sha, status, conclusion, title, summary, details_url } = args;

    // Get installation ID from environment
    const installationId = parseInt(process.env.GITHUB_INSTALLATION_ID || '0');
    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID environment variable is required');
    }

    const githubClient = GitHubClient.forInstallation(config, installationId);

    const checkOptions: {
      name: string;
      status: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
      output?: {
        title: string;
        summary: string;
      };
      details_url?: string;
    } = {
      name: config.github.check_name,
      status,
    };

    if (conclusion) {
      checkOptions.conclusion = conclusion;
    }

    if (title || summary) {
      checkOptions.output = {
        title: title || 'Code Review',
        summary: summary || `Code review ${status}`,
      };
    }

    if (details_url) {
      checkOptions.details_url = details_url;
    }

    const response = await githubClient.createCheckRun(
      owner,
      repo,
      commit_sha,
      checkOptions
    );

    return {
      success: true,
      check_run_id: response.id
    };
  } catch (error) {
    console.error('Failed to create check run:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
