export interface PRDetails {
  pr_number: number;
  repository_id: number;
  commit_sha: string;
  pr_url: string;
}

export interface PRContext {
  owner: string;
  repo: string;
  pr_number: number;
  repository_id: number;
  commit_sha: string;
  pr_url: string;
  repository_full_name: string;
}

export interface GitHubPullRequestEvent {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    state: string;
    title: string;
    body: string;
    user: {
      id: number;
      login: string;
      avatar_url: string;
    };
    head: {
      sha: string;
      ref: string;
    };
    base: {
      sha: string;
      ref: string;
    };
    html_url: string;
    mergeable: boolean | null;
    merged: boolean;
    draft: boolean;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      id: number;
      login: string;
    };
  };
  sender: {
    id: number;
    login: string;
  };
}

export const CHECK_STATUS = {
  QUEUED: 'queued' as const,
  IN_PROGRESS: 'in_progress' as const,
  COMPLETED: 'completed' as const,
};

export const CHECK_CONCLUSION = {
  SUCCESS: 'success' as const,
  FAILURE: 'failure' as const,
  NEUTRAL: 'neutral' as const,
  CANCELLED: 'cancelled' as const,
  SKIPPED: 'skipped' as const,
  TIMED_OUT: 'timed_out' as const,
};
