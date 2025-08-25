import { GitHubClient } from '../../github/client.js';
import { Config } from '../../config.js';

export interface GetPRInfoArgs {
  owner: string;
  repo: string;
  pr_number: number;
  include_diff?: boolean;
}

export async function getPRInfo(
  args: GetPRInfoArgs,
  config: Config,
  githubClient: GitHubClient
): Promise<{ 
  success: boolean; 
  pr_info?: unknown; 
  diff?: string;
  repository_info?: unknown;
  error?: string 
}> {
  try {
    const { owner, repo, pr_number, include_diff = false } = args;

    // Get PR info
    const prInfo = await githubClient.getPRInfo(owner, repo, pr_number);
    
    // Get repository info for additional context
    const repositoryInfo = await githubClient.getRepositoryInfo(owner, repo);

    let diff;
    if (include_diff) {
      diff = await githubClient.getPRDiff(owner, repo, pr_number);
    }

    return {
      success: true,
      pr_info: prInfo,
      repository_info: repositoryInfo,
      ...(diff && { diff })
    };
  } catch (error) {
    console.error('Failed to get PR info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
