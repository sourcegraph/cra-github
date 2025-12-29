import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execute } from '@sourcegraph/amp-sdk';
import { Config, getConfig } from "../config.js";

export const reviewDiff = async (
  diffContent: string, 
  prContent: string, 
  id: string,
  env: NodeJS.ProcessEnv = {}
) => {

    // Get config
    const config: Config = getConfig();

    // Prepare temp directory
    const tempDir = join(tmpdir(), '.amp', uuidv4());
    mkdirSync(tempDir, { recursive: true });

  try {      
      // Create prompt content
      const ampConfig = config.amp;
            
      const promptContent = ampConfig.prompt_template
        .replace(/__PR_DETAILS_CONTENT__/g, prContent)
        .replace(/__DIFF_CONTENT__/g, diffContent);

      // Generate unique filename for comment collection
      const commentsFileName = `comments-${id}.jsonl`;
      const commentsFilePath = join(tempDir, commentsFileName);

      // Set up environment variables for toolbox
      const toolboxPath = join(process.cwd(), 'dist/toolbox');
      const toolboxEnv = {
        ...env,
        COMMENTS_FILE: commentsFilePath,
      };

      // Execute Amp review using SDK
      let threadId: string | undefined;
      let result: string | undefined;
      let commentsContent: string | undefined;
      
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

      // Read comments file with separate error handling
      try {
        if (existsSync(commentsFilePath)) {
          commentsContent = readFileSync(commentsFilePath, 'utf-8').trim();
        }
      } catch (fileError) {
        console.error(`Error reading comments file: ${fileError}`);
      }

      return { success: true, threadId, result, commentsFilePath, commentsContent };
  } catch (error) {
    console.error(`Error executing review: ${error}`);
    throw new Error(`Failed to execute review: ${error}`);
  }
}
