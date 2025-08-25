import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface TriggerReviewArgs {
  owner: string;
  repo: string;
  pr_number: number;
  commit_sha?: string;
  force?: boolean;
}

export async function triggerReview(
  args: TriggerReviewArgs,
  config: Config
): Promise<{ success: boolean; review_id?: string; check_run_id?: number; error?: string }> {
  try {
    const { owner, repo, pr_number, commit_sha } = args;

    // Get installation ID from environment
    const installationId = parseInt(process.env.GITHUB_INSTALLATION_ID || '0');
    if (!installationId) {
      throw new Error('GITHUB_INSTALLATION_ID environment variable is required');
    }

    const githubClient = GitHubClient.forInstallation(config, installationId);

    // Get PR info to get the latest commit if not provided
    const prInfo = await githubClient.getPRInfo(owner, repo, pr_number);
    const targetCommitSha = commit_sha || prInfo.head.sha;

    // Create check run to indicate review is starting
    const checkRun = await githubClient.createCheckRun(
      owner,
      repo,
      targetCommitSha,
      {
        name: config.github.check_name,
        status: 'in_progress',
        output: {
          title: 'Code Review',
          summary: 'Code review in progress...'
        }
      }
    );

    // In a real implementation, this would trigger the actual review process
    // For now, we'll just return success with a mock review ID
    const reviewId = `review_${owner}_${repo}_${pr_number}_${Date.now()}`;

    return {
      success: true,
      review_id: reviewId,
      check_run_id: checkRun.id
    };
  } catch (error) {
    console.error('Failed to trigger review:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
