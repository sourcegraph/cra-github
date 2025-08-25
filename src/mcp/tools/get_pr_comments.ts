import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface GetPRCommentsArgs {
  owner: string;
  repo: string;
  pr_number: number;
}

export async function getPRComments(
  args: GetPRCommentsArgs,
  config: Config
): Promise<{ 
  success: boolean; 
  comments?: unknown[]; 
  total_comments?: number;
  error?: string 
}> {
  try {
    const { owner, repo, pr_number } = args;

    // Get installation ID from environment
    const installationId = parseInt(process.env.GITHUB_INSTALLATION_ID || '0');
    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID environment variable is required');
    }

    const githubClient = GitHubClient.forInstallation(config, installationId);

    const comments = await githubClient.getPRComments(owner, repo, pr_number);
    
    return {
      success: true,
      comments,
      total_comments: comments.length
    };
  } catch (error) {
    console.error('Failed to get PR comments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
