import { getCollector } from '../comment-collector.js';

export interface LeaveInlineCommentArgs {
  message: string;
  owner: string;
  repo: string;
  pr_number: number;
  path: string;
  line: number;
  commit_sha?: string;
}

export async function leaveInlineComment(
  args: LeaveInlineCommentArgs
): Promise<{ success: boolean; error?: string }> {
  try {
    const { message, path, line } = args;

    console.log('📝 Collecting inline comment for later review:', { path, line });
    
    const collector = getCollector();
    if (collector) {
      collector.addInlineComment(path, line, message);
    } else {
      console.log('⚠️ No collector available, comment will be skipped');
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to collect inline comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
