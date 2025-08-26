import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Config, getConfig } from "../config.js";
import { newThread, execute } from "../amp.js";


export const reviewDiff = async (diffContent: string, mrDetailsContent: string, installationId: number) => {

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
      
      let promptContent = ampConfig.prompt_template
        .replace(/__PR_DETAILS_CONTENT__/g, mrDetailsContent)
        .replace(/__DIFF_CONTENT__/g, diffContent);

      // Add tools content
      let toolsContent = '<tools>';
      toolsContent += ampConfig.tools.map(tool => {
        return `
        <tool>
            <title>${tool.name}</title>
            <description>${tool.description}</description>
            <instructions>${tool.instructions.join('\n')}</instructions>
        </tool>
    `;
      }).join('');
      toolsContent += '</tools>';
      promptContent = promptContent.replace(/__TOOL_CONTENT__/g, toolsContent);

      // Write prompt to file
      writeFileSync(promptFilePath, promptContent, 'utf8');

      // Write settings to file with installation ID
      const settings = { ...ampConfig.settings };
      
      // Ensure GitHub MCP server environment exists and set installation ID
      settings['amp.mcpServers'] = {
        ...settings['amp.mcpServers'],
        github: {
          ...settings['amp.mcpServers']?.github,
          env: {
            ...settings['amp.mcpServers']?.github?.env,
            GITHUB_INSTALLATION_ID: installationId.toString(),
          }
        }
      };
      
      console.log('🔧 Amp settings with installation ID:', JSON.stringify(settings['amp.mcpServers']?.github?.env, null, 2));
      
      writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');

      const threadId = await newThread(tempDir);
      const result = await execute({
        promptFilePath,
        resultFilePath,
        settingsFilePath,
        folderPath: tempDir,
        debug: true,
        logging: true,
        threadId
      });

      return { success: true, threadId, result };
  } catch (error) {
    console.error(`Error starting thread: ${error}`);
    throw new Error(`Failed to start thread: ${error}`);
  }
}
