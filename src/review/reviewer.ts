import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execute } from '@sourcegraph/amp-sdk';
import { Config, getConfig } from "../config.js";
import { PRContext } from "../github/types.js";


export const reviewDiff = async (
  diffContent: string, 
  prContext: PRContext, 
  installationId: number
) => {

    // Get config
    const config: Config = getConfig();

    // Prepare temp directory
    const tempDir = join(tmpdir(), '.amp', uuidv4());
    mkdirSync(tempDir, { recursive: true });

  try {      
      // Create prompt content
      const ampConfig = config.amp;
      
      // Format PR context for prompt
      const prDetailsContent = `Repository: ${prContext.repository_full_name}\nPR Number: ${prContext.pr_number}\nCommit SHA: ${prContext.commit_sha}\nPR URL: ${prContext.pr_url}`;
      
      const promptContent = ampConfig.prompt_template
        .replace(/__PR_DETAILS_CONTENT__/g, prDetailsContent)
        .replace(/__DIFF_CONTENT__/g, diffContent);

      // Generate unique filename for comment collection
      const commentsFileName = `comments-${installationId}.jsonl`;
      const commentsFilePath = join(tempDir, commentsFileName);

      // Set up environment variables for toolbox
      const toolboxPath = join(process.cwd(), 'dist/toolbox');
      const toolboxEnv = {
        COMMENTS_FILE: commentsFilePath,

        GITHUB_INSTALLATION_ID: installationId.toString(),
        GITHUB_OWNER: prContext.owner,
        GITHUB_REPO: prContext.repo,
        GITHUB_PR_NUMBER: prContext.pr_number.toString(),
        GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
        GITHUB_APP_PRIVATE_KEY_PATH: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
        GITHUB_APP_CWD: process.env.GITHUB_APP_CWD || '',
      };

      // Execute Amp review using SDK
      let threadId: string | undefined;
      let result: string | undefined;
      
      console.log('[Amp] Starting thread...');
      for await (const message of execute({
        prompt: promptContent,
        options: {
          cwd: tempDir,
          dangerouslyAllowAll: true,
          env: { ...toolboxEnv },
          toolbox: toolboxPath,
        }
      })) {
        if (message.type === 'system' && message.subtype === 'init') {
          // Capture session ID (thread ID) from system message
          threadId = message.session_id;
          console.log(`[Amp] Started thread: ${threadId}`);
        } else if (message.type === 'result') {
          if (message.is_error) {
            throw new Error(`[Amp] Review failed: ${message.error}`);
          }
          result = message.result;
          console.log(`[Amp] Review completed successfully`);
        }
      }
      console.log('[Amp] Iterator completed');

      // Check if threadId and result are defined
      if (!threadId || !result) throw new Error('Amp review failed');

      return { success: true, threadId, result, commentsFilePath };
  } catch (error) {
    console.error(`Error starting thread: ${error}`);
    throw new Error(`Failed to start thread: ${error}`);
  }
}
