import { getConfig } from '../config.js';

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
    default:
      console.log(`Unknown command: /${command}`);
      return { message: `Unknown command: /${command}` };
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
