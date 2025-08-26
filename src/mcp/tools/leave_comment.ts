import { getCurrentCollector } from '../../review/comment-collector.js';

export interface LeaveGeneralCommentArgs {
  message: string;
  owner: string;
  repo: string;
  pr_number: number;
}

export async function leaveGeneralComment(
  args: LeaveGeneralCommentArgs
): Promise<{ success: boolean; error?: string }> {
  try {
    const { message } = args;

    console.log('📝 Collecting general comment for later review');
    
    const collector = getCurrentCollector();
    collector.addGeneralComment(message);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to collect general comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
