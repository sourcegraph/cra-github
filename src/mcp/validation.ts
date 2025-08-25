import { z } from 'zod';
import { LeaveGeneralCommentArgs } from './tools/leave_comment.js';
import { LeaveInlineCommentArgs } from './tools/leave_inline_comment.js';
import { CreateCheckRunArgs } from './tools/create_check_run.js';
import { GetPRInfoArgs } from './tools/get_pr_info.js';
import { TriggerReviewArgs } from './tools/trigger_review.js';
import { GetPRCommentsArgs } from './tools/get_pr_comments.js';

// Reusable schema fragments
const ownerRepoPr = z.object({
  owner: z.string(),
  repo: z.string(),
  pr_number: z.number(),
});

// Schema definitions
const LeaveGeneralCommentArgsSchema = ownerRepoPr.extend({
  message: z.string(),
});

const LeaveInlineCommentArgsSchema = ownerRepoPr.extend({
  message: z.string(),
  path: z.string(),
  line: z.number(),
  commit_sha: z.string().optional(),
});

const CreateCheckRunArgsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  commit_sha: z.string(),
  status: z.enum(['queued', 'in_progress', 'completed']),
  conclusion: z.enum(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out']).optional(),
});

const GetPRInfoArgsSchema = ownerRepoPr.extend({
  include_diff: z.boolean().optional(),
});

const TriggerReviewArgsSchema = ownerRepoPr.extend({
  commit_sha: z.string().optional(),
  force: z.boolean().optional(),
});

const GetPRCommentsArgsSchema = ownerRepoPr;

// Validation functions - now just one line each!
export function validateLeaveGeneralCommentArgs(args: unknown): LeaveGeneralCommentArgs {
  return LeaveGeneralCommentArgsSchema.parse(args);
}

export function validateLeaveInlineCommentArgs(args: unknown): LeaveInlineCommentArgs {
  return LeaveInlineCommentArgsSchema.parse(args);
}

export function validateCreateCheckRunArgs(args: unknown): CreateCheckRunArgs {
  return CreateCheckRunArgsSchema.parse(args);
}

export function validateGetPRInfoArgs(args: unknown): GetPRInfoArgs {
  return GetPRInfoArgsSchema.parse(args);
}

export function validateTriggerReviewArgs(args: unknown): TriggerReviewArgs {
  return TriggerReviewArgsSchema.parse(args);
}

export function validateGetPRCommentsArgs(args: unknown): GetPRCommentsArgs {
  return GetPRCommentsArgsSchema.parse(args);
}
