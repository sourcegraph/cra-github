import { getConfig } from "../config.js";
import { reviewDiff } from "../review/reviewer.js";
import { GitHubClient } from "./client.js";
import { CHECK_STATUS, CHECK_CONCLUSION, GitHubPullRequestEvent } from "./types.js";

export async function processReview(
  jobId: string,
  installationId: number,
  payload: GitHubPullRequestEvent
): Promise<void> {
  const config = await getConfig();
  
  // Use GITHUB_TOKEN from Actions environment if available, otherwise use GitHub App
  const githubToken = process.env.GITHUB_TOKEN;
  const githubClient = GitHubClient.create(config, 
    githubToken 
      ? { token: githubToken }
      : { installationId }
  );

  // Skip check runs in GitHub Actions mode (workflow provides its own)
  const manageChecks = process.env.GITHUB_ACTIONS !== 'true';

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

    // Create check run (only in webhook mode)
    let checkRunId: number | undefined;
    if (manageChecks) {
      const checkRun = await githubClient.createCheckRun(owner, repo, commitSha, {
        name: config.github.check_name,
        status: CHECK_STATUS.IN_PROGRESS,
        output: {
          title: 'Code Review',
          summary: 'Analyzing changes...',
        },
        details_url: prUrl,
      });
      checkRunId = checkRun.id;
    }

    // Get diff content from GitHub API
    console.log('Fetching diff content from GitHub API...');
    const diffContent = await githubClient.getFilteredPRDiff(owner, repo, prNumber);

    if (!diffContent) {
      console.log('No diff content found, completing review without analysis');
      
      // Update check run with success since there's nothing to review (only in webhook mode)
      if (manageChecks && checkRunId) {
        await githubClient.updateCheckRun(owner, repo, checkRunId, {
          status: CHECK_STATUS.COMPLETED,
          conclusion: CHECK_CONCLUSION.SUCCESS,
          output: {
            title: 'Code Review Completed',
            summary: 'No reviewable changes found based on configured file patterns.',
          },
          details_url: prUrl,
        });
      }
      
      return;
    }

    console.log(`Retrieved diff content (${diffContent.length} chars)`);

    // Context for agent to find PR
    const prContent = `Repository: ${payload.repository.full_name}\nPR Number: ${prNumber}\nCommit SHA: ${commitSha}\nPR URL: ${prUrl}`;

    console.log(`Calling reviewDiff() for job ${jobId}`);
    const reviewResult = await reviewDiff(diffContent, prContent, installationId.toString(), {
      GITHUB_INSTALLATION_ID: installationId.toString(),
      GITHUB_OWNER: owner,
      GITHUB_REPO: repo,
      GITHUB_PR_NUMBER: prNumber.toString(),
      GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
      GITHUB_APP_PRIVATE_KEY_PATH: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
      GITHUB_APP_CWD: process.env.GITHUB_APP_CWD || '',
    });
    console.log(`Review completed for job ${jobId}`);

    // Read collected comments from file
    const fs = await import('fs');
    const commentsContent = reviewResult.commentsContent;

    if (commentsContent) {
      try {
        console.log(`Found comments file with ${commentsContent.length} characters`);

        const commentLines = commentsContent.split('\n');
        const comments = commentLines.map(line => JSON.parse(line));

        const inlineComments = comments.filter(c => c.type === 'inline');
        const generalComments = comments.filter(c => c.type === 'general');

        // TODO(sayans): GitHub API allows <= 30 comments per review, so we need to add splitting logic if there are > 30 comments

        console.log(`Collected ${inlineComments.length} inline comments and ${generalComments.length} general comments`);

        // Create review summary from general comments
        let reviewSummary = generalComments.length > 0
          ? generalComments.map(c => c.message).join('\n\n')
          : 'Code review completed.';

        // Append Amp thread URL if available
        if (reviewResult.threadId && config.amp.server_url) {
          const threadUrl = `${config.amp.server_url}/threads/${reviewResult.threadId}`;
          reviewSummary += `\n\n[View this review on Amp](${threadUrl})`;
        }

        // Post aggregated review
        console.log('Posting aggregated PR review...');
        await githubClient.createPRReview(
          owner,
          repo,
          prNumber,
          reviewSummary,
          'COMMENT',
          inlineComments.map(comment => ({
            path: comment.path,
            line: comment.line,
            body: comment.suggested_fix
              ? `${comment.message}\n\n\`\`\`suggestion\n${comment.suggested_fix}\n\`\`\``
              : comment.message
          }))
        );
        console.log('PR review posted successfully');

        // Clean up the comments file
        fs.unlinkSync(reviewResult.commentsFilePath);
        console.log('Cleaned up comments file');

      } catch (error) {
        console.error('Failed to read or process comments file:', error);
      }
    } else {
      console.log('No comments file found, skipping review creation');
    }

    // Update check run with success (only in webhook mode)
    if (manageChecks && checkRunId) {
      await githubClient.updateCheckRun(owner, repo, checkRunId, {
        status: CHECK_STATUS.COMPLETED,
        conclusion: CHECK_CONCLUSION.SUCCESS,
        output: {
          title: 'Code Review Completed',
          summary: 'Code review has been completed successfully. See PR conversation for details.',
        },
        details_url: prUrl,
        actions: [{
          label: 'Re-run review',
          description: 'Request a new code review for this PR',
          identifier: 're-run-review'
        }]
      });
    }

  } catch (error) {
    console.error(`Review job ${jobId} failed with exception:`, error);

    // Post FAILED check run for exceptions (only in webhook mode)
    if (manageChecks) {
      await postFailureCheckRun(githubClient, payload, error instanceof Error ? error.message : String(error));
    }
  }
}

async function postFailureCheckRun(
  githubClient: GitHubClient,
  payload: GitHubPullRequestEvent,
  errorMessage: string
): Promise<void> {
  const config = await getConfig();

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
