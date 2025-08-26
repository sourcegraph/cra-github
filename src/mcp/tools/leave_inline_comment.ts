import { getCurrentCollector } from '../../review/comment-collector.js';

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
    
    // Get session ID from environment (passed by the review process)
    const sessionId = process.env.REVIEW_SESSION_ID;
    if (!sessionId) {
      throw new Error('No REVIEW_SESSION_ID found in environment. Review session not properly initialized.');
    }
    
    const collector = getCurrentCollector(sessionId);
    collector.addInlineComment(path, line, message);
    
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
