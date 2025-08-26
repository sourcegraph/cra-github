import { z } from 'zod';
import { LeaveGeneralCommentArgs } from './tools/leave_comment.js';
import { LeaveInlineCommentArgs } from './tools/leave_inline_comment.js';
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


const GetPRCommentsArgsSchema = ownerRepoPr;

// Validation functions - now just one line each!
export function validateLeaveGeneralCommentArgs(args: unknown): LeaveGeneralCommentArgs {
  return LeaveGeneralCommentArgsSchema.parse(args);
}

export function validateLeaveInlineCommentArgs(args: unknown): LeaveInlineCommentArgs {
  return LeaveInlineCommentArgsSchema.parse(args);
}


export function validateGetPRCommentsArgs(args: unknown): GetPRCommentsArgs {
  return GetPRCommentsArgsSchema.parse(args);
}
