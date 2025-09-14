import { getConfig } from '../config.js';
import { reviewDb } from '../database/index.js';
import { addContext } from './reviewer.js';
import { PRContext } from './types.js';

/**
 * Process slash commands
 */
export async function processSlashCommand(command: string, args: string, payload: any) {
  const installationId = payload.installation?.id;
  const repo = payload.repository;
  const issue = payload.issue;
  const comment = payload.comment;

  if (!installationId || !repo || !issue) {
    throw new Error('Missing required data for command processing');
  }

  switch (command) {
    case 'example':
      return await handleExampleCommand(args, { installationId, repo, issue, comment });
    case 'question':
      return await handleQuestionCommand(args, { installationId, repo, issue, comment });
    default:
      console.log(`Unknown command: /${command}`);
      return { message: `Unknown command: /${command}` };
  }
}

/**
 * Handle /question command
 */
async function handleQuestionCommand(args: string, context: any) {
  const { installationId, repo, issue, comment } = context;
  
  if (!args.trim()) {
    return { 
      message: 'Please provide a question after /question command',
      error: 'No question provided'
    };
  }

  const prContext: PRContext = { owner: repo.owner.login, repo: repo.name, pr_number: issue.number };

  console.log(`Question command executed with question: "${args}"`);
  console.log(`PR #${prContext.pr_number} in ${prContext.repo}`);

  try {
    // Get latest review from database using PR details
    const existingReview = reviewDb.getLatestReviewByPR(
      repo.owner.login,
      repo.name,
      issue.number.toString()
    );

    if (!existingReview) {
      return {
        message: `No existing review found for PR #${prContext.pr_number}. Please run a code review first before asking questions.`,
        error: 'No review thread found'
      };
    }

    console.log('Found existing review:', existingReview);

    // Build prompt
    let prompt = `**Question about the review**: ${args}\n\n`;

    // Add instructions
    prompt += `**Instructions**: Use the \`leave_general_command_comment\` tool to leave a response to this question on the pull request.\n`;

    // Use the simplified addContext function
    const result = await addContext(existingReview.threadId, prompt, installationId, prContext);

    return { 
      message: 'Question processed successfully',
      command: 'question',
      question: args,
      threadId: result.threadId,
      success: result.success
    };
  } catch (error) {
    console.error('Error in question command:', error);
    return { 
      message: 'Question command failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handle /example command
 */
async function handleExampleCommand(args: string, context: any) {
  const { installationId, repo, issue, comment } = context;
  
  console.log(`Example command executed with args: "${args}"`);
  console.log(`PR #${issue.number} in ${repo.full_name}`);
  console.log(`Comment by: ${comment.user.login}`);

  // Example: Post a reply comment to the PR
  try {
    const config = getConfig();
    const { GitHubClient } = await import('../github/client.js');
    const githubClient = GitHubClient.create(config, { installationId });

    const replyBody = `Hello! I received your command with args: "${args}"`;
    
    await githubClient.createIssueComment(
      repo.owner.login,
      repo.name,
      issue.number,
      replyBody
    );

    return { 
      message: 'Example command executed successfully',
      command: 'example',
      args: args,
      reply_posted: true
    };
  } catch (error) {
    console.error('Error in example command:', error);
    return { 
      message: 'Example command failed',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
