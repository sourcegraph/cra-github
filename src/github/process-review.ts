import { getConfig } from "../config.js";
import { reviewDiff } from "../review/reviewer.js";
import { GitHubClient } from "./client.js";
import { CHECK_STATUS, CHECK_CONCLUSION, PRDetails, GitHubPullRequestEvent } from "./types.js";

export async function processReview(
    jobId: string, 
    githubClient: GitHubClient, 
    payload: GitHubPullRequestEvent
  ): Promise<void> {
    const config = await getConfig();

    try {
      // Extract PR information
      const prNumber = payload.pull_request.number;
      const repositoryId = payload.repository.id;
      const commitSha = payload.pull_request.head.sha;
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;

      if (!prNumber || !repositoryId || !commitSha) {
        const error = 'Missing required PR information';
        console.error(error);
        throw new Error(error);
      }

      // Generate PR URL
      const prUrl = payload.pull_request.html_url;

      // Create check run
      const checkRun = await githubClient.createCheckRun(owner, repo, commitSha, {
        name: config.github.check_name,
        status: CHECK_STATUS.IN_PROGRESS,
        output: {
          title: 'Code Review',
          summary: 'Analyzing changes...',
        },
        details_url: prUrl,
      });

      // Get diff content from GitHub API
      console.log('Fetching diff content from GitHub API...');
      const diffContent = await githubClient.getPRDiff(owner, repo, prNumber);
      
      if (!diffContent) {
        const error = 'No diff content found';
        console.error(error);
        throw new Error(error);
      }

      console.log(`Retrieved diff content (${diffContent.length} chars)`);

      // Create PR details object
      const prDetails: PRDetails = {
        pr_number: prNumber,
        repository_id: repositoryId,
        commit_sha: commitSha,
        pr_url: prUrl,
      };

      const prDetailsContent = `Repository: ${payload.repository.full_name}, PR Number: ${prDetails.pr_number}, Commit SHA: ${prDetails.commit_sha}, PR URL: ${prDetails.pr_url}`;

      console.log(`Calling reviewDiff() for job ${jobId}`);
      const reviewResult = await reviewDiff(diffContent, prDetailsContent);
      console.log(`Review completed for job ${jobId}`);

      // Update check run with success
      await githubClient.updateCheckRun(owner, repo, checkRun.id, {
        status: CHECK_STATUS.COMPLETED,
        conclusion: CHECK_CONCLUSION.SUCCESS,
        output: {
          title: 'Code Review Completed',
          summary: 'Code review has been completed successfully.',
          text: reviewResult.result || 'Review completed successfully.',
        },
        details_url: prUrl,
      });

    } catch (error) {
      console.error(`Review job ${jobId} failed with exception:`, error);
      // Post FAILED check run for exceptions
      await postFailureCheckRun(githubClient, payload, error instanceof Error ? error.message : String(error));
  }
}

async function postFailureCheckRun(
  githubClient: GitHubClient,
    payload: GitHubPullRequestEvent,
    errorMessage: string
  ): Promise<void> {
    const config = getConfig();

    try {
      const commitSha = payload.pull_request.head.sha;
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      
      if (commitSha && owner && repo) {
        await githubClient.createCheckRun(owner, repo, commitSha, {
          name: config.github.check_name,
          status: CHECK_STATUS.COMPLETED,
          conclusion: CHECK_CONCLUSION.FAILURE,
          output: {
            title: 'Code Review Failed',
            summary: `Review failed: ${errorMessage.substring(0, 100)}...`,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to post failure check run:`, error);
    }
}
