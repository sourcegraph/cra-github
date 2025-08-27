import { getCollector } from '../comment-collector.js';

export interface LeaveGeneralCommentArgs {
  message: string;
}

export async function leaveGeneralComment(
  args: LeaveGeneralCommentArgs
): Promise<{ success: boolean; error?: string }> {
  try {
    const { message } = args;

    console.log('📝 Collecting general comment for later review');
    
    const collector = getCollector();
    if (collector) {
      collector.addGeneralComment(message);
    } else {
      console.log('⚠️ No collector available, comment will be skipped');
    }
    
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
