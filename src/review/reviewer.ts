import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Config, getConfig } from "../config.js";
import { newThread, execute as ampExecute } from "../amp.js";
import { PRContext } from "../github/types.js";
import { execute } from "@sourcegraph/the-orb-is-awake";


export const reviewDiff = async (
  diffContent: string, 
  prContext: PRContext, 
  installationId: number
) => {

    // Get config
    const config: Config = getConfig();

    // Prepare temp files
    const tempDir = tmpdir();
    const promptFilePath = join(tempDir, `amp-prompt-${uuidv4()}.txt`);
    const resultFilePath = join(tempDir, `amp-result-${uuidv4()}.txt`);
    const settingsFilePath = join(tempDir, `amp-settings-${uuidv4()}.json`);

  try {      
      // Create prompt content
      const ampConfig = config.amp;
      
      // Format PR context for prompt
      const prDetailsContent = `Repository: ${prContext.repository_full_name}\nPR Number: ${prContext.pr_number}\nCommit SHA: ${prContext.commit_sha}\nPR URL: ${prContext.pr_url}`;
      
      const promptContent = ampConfig.prompt_template
        .replace(/__PR_DETAILS_CONTENT__/g, prDetailsContent)
        .replace(/__DIFF_CONTENT__/g, diffContent);

      // Tools are now auto-discovered by Amp via toolbox - no manual injection needed

      // Write prompt to file
      writeFileSync(promptFilePath, promptContent, 'utf8');

      // Generate unique filename for comment collection
      const commentsFileName = `comments-${installationId}-${uuidv4()}.jsonl`;
      const commentsFilePath = join(tempDir, commentsFileName);

      // Write settings to file
      const settings = { 
        ...ampConfig.settings
      };
      
      writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');

      const threadId = await newThread(tempDir);

      // Run prompt with message streaming from SDK
      for await (const message of execute({
        prompt: readFileSync(promptFilePath, 'utf8'),
        options: {
          env: {
            GITHUB_INSTALLATION_ID: installationId.toString(),
            COMMENTS_FILE: commentsFilePath,
            GITHUB_OWNER: prContext.owner,
            GITHUB_REPO: prContext.repo,
            GITHUB_PR_NUMBER: prContext.pr_number.toString(),
            GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
            GITHUB_APP_PRIVATE_KEY_PATH: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
            GITHUB_APP_CWD: process.env.GITHUB_APP_CWD || '',
            AMP_TOOLBOX: process.env.AMP_TOOLBOX || '',
          },
          dangerouslyAllowAll: true,
          continue: threadId,
          cwd: tempDir,
          settingsFile: settingsFilePath,
        }
      })) {        
        if (message.type === 'result') {
          console.log('Final result:', 'result' in message ? message.result : 'No result')
        }
      }

      return { success: true, threadId, commentsFilePath };
  } catch (error) {
    console.error(`Error starting thread: ${error}`);
    throw new Error(`Failed to start thread: ${error}`);
  }
}
