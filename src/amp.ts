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
        // Extract more details from the exec error
        const execError = error as { code: number, stderr: string };
        const exitCode = execError.code || 'unknown';
        const stderr = execError.stderr || '';
        
        if (logging) {
            console.log(`[AMP] Command exited with code: ${exitCode}`);
            if (stderr) {
                console.log(`[AMP] stderr: ${stderr}`);
            }
        }
        
        // Handle Amp CLI terminal cleanup behavior:
        // Amp returns exit code 1 when it runs terminal cleanup (writes cursor control codes to stderr)
        // even though the actual command execution succeeded. This happens in containerized environments
        // where Amp detects terminal-like behavior and attempts cleanup on exit.
        // Rather than trying to prevent this (fragile), we check if the expected output files exist,
        // which is the semantic definition of success for our use case.
        if (resultFilePath) {
            const fs = await import('fs');
            
            if (fs.existsSync(resultFilePath)) {
                if (logging) {
                    console.log(`[AMP] Result file exists despite exit code ${exitCode}, treating as success`);
                }
                try {
                    return fs.readFileSync(resultFilePath, 'utf8');
                } catch (readError) {
                    console.error(`[AMP] Failed to read result file: ${readError}`);
                }
            }
        }
        
        throw new Error(`Failed to execute command (exit code ${exitCode}): ${error instanceof Error ? error.message : String(error)}${stderr ? `\nstderr: ${stderr}` : ''}`);
    }
}


