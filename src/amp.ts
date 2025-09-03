import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getConfig, Config } from "./config.js";

const execAsync = promisify(exec);

export interface AmpResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export interface ExecuteCommandOptions {
	prompt?: string;
    folderPath?: string;
    threadId?: string;
    promptFilePath?: string;
    settingsFilePath?: string;
    resultFilePath?: string;
    debug?: boolean;
    logging?: boolean;
    env?: Record<string, string>;
}

export async function newThread(folderPath: string = tmpdir()): Promise<string> {
    if (!folderPath) {
        throw new Error("Folder path not set");
    }

    const config: Config = getConfig();
    
    try {
        const command = `${config.amp.command} threads new`;
        const { stdout } = await execAsync(command, { cwd: folderPath });
        
        // Extract thread ID from stdout (assuming it's returned as the thread ID)
        const threadId = stdout.trim();
        
        return threadId;
    } catch (error) {
        throw new Error(`Failed to start thread: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function execute(options: ExecuteCommandOptions = {}): Promise<string> {
    const { 
        prompt,
        promptFilePath,
        settingsFilePath,
        resultFilePath,
        folderPath = tmpdir(),
        debug = false,
        logging = false,
        env: customEnv = {}
    } = options;

    let { threadId } = options;
    
    try {
        const config: Config = getConfig();
        
        if (!threadId) {
            threadId = await newThread(folderPath);
        }

        const includePrompt = prompt ? `echo "${prompt.replace(/\n/g, "\\n")}" | ` : '';
        const includePromptFile = promptFilePath ? `cat ${promptFilePath} | ` : '';
        const includeThread = threadId ? ` threads continue ${threadId}` : '';
        const includeDebug = debug ? ` --log-level debug ` : '';
        const includeSettings = settingsFilePath ? ` --settings-file ${settingsFilePath} ` : '';
        const includeResult = resultFilePath ? ` > ${resultFilePath}` : '';
            
        // Build the command string
        const command = `${prompt ? includePrompt : includePromptFile}${config.amp.command}${includeThread}${includeDebug}${includeSettings}${includeResult}`;
        
        // Set up toolbox environment variables  
        const toolboxPath = join(process.cwd(), 'dist/toolbox');
        const env = {
            ...process.env,
            AMP_TOOLBOX: toolboxPath,
            ...customEnv
        };

        // Execute command
        const { stdout, stderr } = await execAsync(command, { cwd: folderPath, env });
        
        if (logging) {
            console.log(`[AMP] Command completed. stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
            if (stderr) {
                console.log(`[AMP] stderr: ${stderr}`);
            }
        }
                
        return stdout;
    } catch (error) {
        throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
}


