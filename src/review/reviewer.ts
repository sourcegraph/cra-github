import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Config, getConfig } from "../config.js";
import { newThread } from "../amp.js";
import { PRContext } from "../github/types.js";
import { execute } from "@sourcegraph/the-orb-is-awake";
import { reviewDb } from "../database/index.js";

// Get settings
const saveSettingsFile = (tempDir: string) => {
  // Get config
    const config: Config = getConfig();

  // Make temporary settings file
  const settingsFilePath = join(tempDir, `amp-settings-${uuidv4()}.json`);

  writeFileSync(settingsFilePath, JSON.stringify({ 
    ...config.amp.settings
  }, null, 2), 'utf8');

  return settingsFilePath;
}

// Get AGENTS.md
const saveAgentsFile = (tempDir: string) => {
  // Get config
    const config: Config = getConfig();

  // Make temporary settings file
  const agentsFilePath = join(tempDir, `AGENTS.md`);

  writeFileSync(agentsFilePath, JSON.stringify(config.amp.agents_md_template, null, 2), 'utf8');

  return agentsFilePath;
}

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

  try {      
      // Create prompt content
      const ampConfig = config.amp;
      
      // Format PR context for prompt
      const prDetailsContent = `Repository: ${prContext.repository_full_name}\nPR Number: ${prContext.pr_number}\nCommit SHA: ${prContext.commit_sha}\nPR URL: ${prContext.pr_url}`;
      
      // Store prompt to file with variables
      const promptContent = ampConfig.prompt_template
        .replace(/__PR_DETAILS_CONTENT__/g, prDetailsContent)
        .replace(/__DIFF_CONTENT__/g, diffContent);

      // Write prompt to file
      writeFileSync(promptFilePath, promptContent, 'utf8');

      // Generate unique filename for comment collection
      const commentsFileName = `comments-${installationId}-${uuidv4()}.jsonl`;
      const commentsFilePath = join(tempDir, commentsFileName);

      // Get SettingsFilePath
      const settingsFilePath = saveSettingsFile(tempDir);

      // Save AGENTS.md
      saveAgentsFile(tempDir);

      // New thread
      const threadId = await newThread(tempDir);

      // Run prompt with message streaming from SDK
      for await (const message of execute({
        prompt: readFileSync(promptFilePath, 'utf8'),
        options: {
          env: {
            AMP_TOOLBOX: process.env.AMP_TOOLBOX || '',

            GITHUB_INSTALLATION_ID: installationId.toString(),
            GITHUB_OWNER: prContext.owner,
            GITHUB_REPO: prContext.repo,
            GITHUB_PR_NUMBER: prContext.pr_number.toString(),
            GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
            GITHUB_APP_PRIVATE_KEY_PATH: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
            GITHUB_APP_CWD: process.env.GITHUB_APP_CWD || '',

            COMMENTS_FILE: commentsFilePath,
          },
          dangerouslyAllowAll: true,
          continue: threadId,
          cwd: tempDir,
          settingsFile: settingsFilePath,
          logLevel: 'debug',
          logFile: "./reviewDiff.log"
        }
      })) {        
        if (message.type === 'result') {
          console.log('Final result:', 'result' in message ? message.result : 'No result')
        }
      }

      // Save review to database
      const review = reviewDb.insertReview({
        owner: prContext.owner,
        repo: prContext.repo,
        prNumber: prContext.pr_number.toString(),
        threadId
      });

      console.log('Review saved to database:', review);

      return { success: true, threadId, commentsFilePath, review };
  } catch (error) {
    console.error(`Error starting thread: ${error}`);
    throw new Error(`Failed to start thread: ${error}`);
  }
}

export const addContext = async (
  threadId: string,
  context: string,
  installationId: number,
  prContext: PRContext
) => {
  // Prepare temp files
  const tempDir = tmpdir();

  try {
    // Get settings
    const settingsFilePath = saveSettingsFile(tempDir);

    // Save AGENTS.md
    saveAgentsFile(tempDir);

    // Run content using existing thread ID
    for await (const message of execute({
      prompt: context,
      options: {
        dangerouslyAllowAll: true,
        continue: threadId,
        cwd: tempDir,
        settingsFile: settingsFilePath,
        env: {
          AMP_TOOLBOX: process.env.AMP_TOOLBOX || '',

          GITHUB_INSTALLATION_ID: installationId.toString(),
          GITHUB_OWNER: prContext.owner,
          GITHUB_REPO: prContext.repo,
          GITHUB_PR_NUMBER: prContext.pr_number.toString(),
          GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
          GITHUB_APP_PRIVATE_KEY_PATH: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
          GITHUB_APP_CWD: process.env.GITHUB_APP_CWD || '',
        },
        logLevel: 'debug',
        logFile: "./addContext.log"
      }
    })) {
      if (message.type === 'system' && message.subtype === 'init') {
        console.log('[INITIALIZED - addContext]', message);
      }
      if (message.type === 'result') {
        console.log('[RESULT - addContext]', 'result' in message ? message.result : 'No result');
      }
    }

    return { success: true, threadId };
  } catch (error) {
    console.error(`Error adding context: ${error}`);
    throw new Error(`Failed to add context: ${error}`);
  }
};