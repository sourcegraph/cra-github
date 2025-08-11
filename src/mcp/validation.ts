import { LeaveGeneralCommentArgs } from './tools/leave_comment.js';
import { LeaveInlineCommentArgs } from './tools/leave_inline_comment.js';
import { CreateCheckRunArgs } from './tools/create_check_run.js';
import { GetPRInfoArgs } from './tools/get_pr_info.js';
import { TriggerReviewArgs } from './tools/trigger_review.js';
import { GetPRCommentsArgs } from './tools/get_pr_comments.js';

export function validateLeaveGeneralCommentArgs(args: any): LeaveGeneralCommentArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }
  
  if (typeof args.message !== 'string') {
    throw new Error('Invalid message: expected string');
  }
  
  if (typeof args.owner !== 'string') {
    throw new Error('Invalid owner: expected string');
  }
  
  if (typeof args.repo !== 'string') {
    throw new Error('Invalid repo: expected string');
  }
  
  if (typeof args.pr_number !== 'number') {
    throw new Error('Invalid pr_number: expected number');
  }
  
  return args as LeaveGeneralCommentArgs;
}

export function validateLeaveInlineCommentArgs(args: any): LeaveInlineCommentArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }
  
  if (typeof args.message !== 'string') {
    throw new Error('Invalid message: expected string');
  }
  
  if (typeof args.owner !== 'string') {
    throw new Error('Invalid owner: expected string');
  }
  
  if (typeof args.repo !== 'string') {
    throw new Error('Invalid repo: expected string');
  }
  
  if (typeof args.pr_number !== 'number') {
    throw new Error('Invalid pr_number: expected number');
  }
  
  if (typeof args.path !== 'string') {
    throw new Error('Invalid path: expected string');
  }
  
  if (typeof args.line !== 'number') {
    throw new Error('Invalid line: expected number');
  }
  
  // Optional commit SHA field validation
  if (args.commit_sha !== undefined && typeof args.commit_sha !== 'string') {
    throw new Error('Invalid commit_sha: expected string or undefined');
  }
  
  return args as LeaveInlineCommentArgs;
}

export function validateCreateCheckRunArgs(args: any): CreateCheckRunArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }
  
  if (typeof args.owner !== 'string') {
    throw new Error('Invalid owner: expected string');
  }
  
  if (typeof args.repo !== 'string') {
    throw new Error('Invalid repo: expected string');
  }
  
  if (typeof args.commit_sha !== 'string') {
    throw new Error('Invalid commit_sha: expected string');
  }
  
  if (!['queued', 'in_progress', 'completed'].includes(args.status)) {
    throw new Error('Invalid status: expected queued, in_progress, or completed');
  }
  
  if (args.conclusion !== undefined && !['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out'].includes(args.conclusion)) {
    throw new Error('Invalid conclusion: expected success, failure, neutral, cancelled, skipped, or timed_out');
  }
  
  return args as CreateCheckRunArgs;
}

export function validateGetPRInfoArgs(args: any): GetPRInfoArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }
  
  if (typeof args.owner !== 'string') {
    throw new Error('Invalid owner: expected string');
  }
  
  if (typeof args.repo !== 'string') {
    throw new Error('Invalid repo: expected string');
  }
  
  if (typeof args.pr_number !== 'number') {
    throw new Error('Invalid pr_number: expected number');
  }
  
  if (args.include_diff !== undefined && typeof args.include_diff !== 'boolean') {
    throw new Error('Invalid include_diff: expected boolean or undefined');
  }
  
  return args as GetPRInfoArgs;
}

export function validateTriggerReviewArgs(args: any): TriggerReviewArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }
  
  if (typeof args.owner !== 'string') {
    throw new Error('Invalid owner: expected string');
  }
  
  if (typeof args.repo !== 'string') {
    throw new Error('Invalid repo: expected string');
  }
  
  if (typeof args.pr_number !== 'number') {
    throw new Error('Invalid pr_number: expected number');
  }
  
  if (args.commit_sha !== undefined && typeof args.commit_sha !== 'string') {
    throw new Error('Invalid commit_sha: expected string or undefined');
  }
  
  if (args.force !== undefined && typeof args.force !== 'boolean') {
    throw new Error('Invalid force: expected boolean or undefined');
  }
  
  return args as TriggerReviewArgs;
}

export function validateGetPRCommentsArgs(args: any): GetPRCommentsArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid arguments: expected object');
  }
  
  if (typeof args.owner !== 'string') {
    throw new Error('Invalid owner: expected string');
  }
  
  if (typeof args.repo !== 'string') {
    throw new Error('Invalid repo: expected string');
  }
  
  if (typeof args.pr_number !== 'number') {
    throw new Error('Invalid pr_number: expected number');
  }
  
  return args as GetPRCommentsArgs;
}
