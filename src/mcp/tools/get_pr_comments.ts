import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface GetPRCommentsArgs {
  owner: string;
  repo: string;
  pr_number: number;
}

export async function getPRComments(
  args: GetPRCommentsArgs,
  config: Config,
  githubClient: GitHubClient
): Promise<{ 
  success: boolean; 
  comments?: unknown[]; 
  total_comments?: number;
  error?: string 
}> {
  try {
    const { owner, repo, pr_number } = args;

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
