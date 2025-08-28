import { getCollector } from '../comment-collector.js';

export interface LeaveInlineCommentArgs {
  message: string;
  path: string;
  line: number;
  suggested_fix?: string;
}

export async function leaveInlineComment(
  args: LeaveInlineCommentArgs
): Promise<{ success: boolean; error?: string }> {
  try {
    const { message, path, line, suggested_fix } = args;

    console.error('Collecting inline comment for later review:', { path, line, hasSuggestion: !!suggested_fix });
    
    const collector = getCollector();
    if (collector) {
      collector.addInlineComment(path, line, message, suggested_fix);
    } else {
      console.error('No collector available, comment will be skipped');
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
