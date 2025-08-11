
export * from '../github/types.js';

export interface ReviewChunk {
  chunk_id: number;
  files: string[];
  total_chars: number;
  diff_content: string;
}

export interface ReviewIssue {
  path: string;
  line: number;
  line_type: 'ADDED' | 'REMOVED' | 'CONTEXT';
  message: string;
  suggested_fix: string | null;
}

export interface ReviewResult {
  success: boolean;
  issues?: ReviewIssue[] | undefined;
  structured_issues?: ReviewIssue[] | undefined;
  final_review?: string | undefined;
  thread_ids?: string[] | undefined;
  error?: string | undefined;
  stats?: {
    total_files_reviewed: number;
    chunks_processed: number;
    chunks_failed: number;
    total_issues: number;
    thread_ids: string[];
  } | undefined;
  partial_failures?: Array<{
    chunk_id: number;
    files: string[];
    error: string;
  }> | undefined;
  // Additional fields for webhook results
  mr_iid?: number | undefined;
  project_id?: number | undefined;
  commit_sha?: string | undefined;
  issues_found?: number | undefined;
  review_result?: ReviewResult | undefined;
}

export interface JobInfo {
  status: 'queued' | 'running' | 'completed' | 'failed';
  created: number;
  started?: number;
  completed?: number;
  id?: number;
  result?: ReviewResult;
  error?: string;
}

export const JOB_STATUS = {
  QUEUED: 'queued' as const,
  RUNNING: 'running' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
};



export const DEFAULT_MAX_CHUNK_SIZE = 500_000;
export const DEFAULT_MAX_CONCURRENT = 3;
export const REVIEW_SUMMARY_HEADER = "## Amp Code Review Summary";
