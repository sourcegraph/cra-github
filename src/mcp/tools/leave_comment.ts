import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface LeaveGeneralCommentArgs {
  message: string;
  owner: string;
  repo: string;
  pr_number: number;
}

export async function leaveGeneralComment(
  args: LeaveGeneralCommentArgs,
  config: Config
): Promise<{ success: boolean; comment_id?: number; error?: string }> {
  try {
    const { message, owner, repo, pr_number } = args;

    const githubClient = GitHubClient.fromEnv(config);
    const response = await githubClient.createPRComment(owner, repo, pr_number, message);
    
    return {
      success: true,
      comment_id: response.id
    };
  } catch (error) {
    console.error('Failed to leave general comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
