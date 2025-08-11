import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface LeaveInlineCommentArgs {
  message: string;
  owner: string;
  repo: string;
  pr_number: number;
  path: string;
  line: number;
  commit_sha?: string;
}

export async function leaveInlineComment(
  args: LeaveInlineCommentArgs,
  config: Config,
  githubClient: GitHubClient
): Promise<{ success: boolean; review_id?: number; error?: string }> {
  try {
    const { message, owner, repo, pr_number, path, line, commit_sha } = args;

    console.log('🎯 Creating inline comment via PR review:', { path, line });
    
    // Get commit SHA if not provided
    let actualCommitSha = commit_sha;
    
    if (!actualCommitSha) {
      console.log('🔍 Fetching commit SHA from PR...');
      try {
        const prInfo = await githubClient.getPRInfo(owner, repo, pr_number);
        actualCommitSha = prInfo.head.sha;
        console.log('✅ Using commit SHA:', actualCommitSha?.substring(0, 8));
      } catch (error) {
        console.log('⚠️ Could not fetch PR info for commit SHA:', error);
        throw new Error('Cannot create inline comment without valid commit SHA');
      }
    }

    if (!actualCommitSha) {
      throw new Error('Missing required commit SHA for inline comment');
    }

    console.log('📍 Creating PR review with inline comment at:', { path, line });

    // Create a review with inline comment
    const response = await githubClient.createPRReview(
      owner, 
      repo, 
      pr_number, 
      message,
      'COMMENT',
      [{
        path,
        line,
        body: message
      }]
    );
    
    return {
      success: true,
      review_id: response.id
    };
  } catch (error) {
    console.error('Failed to leave inline comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
