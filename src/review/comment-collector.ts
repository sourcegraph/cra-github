// Comment collection system for aggregating MCP tool comments into a single PR review

export interface InlineComment {
  path: string;
  line: number;
  body: string;
}

export interface GeneralComment {
  body: string;
}

export class ReviewCommentCollector {
  private inlineComments: InlineComment[] = [];
  private generalComments: GeneralComment[] = [];

  addInlineComment(path: string, line: number, body: string): void {
    this.inlineComments.push({ path, line, body });
  }

  addGeneralComment(body: string): void {
    this.generalComments.push({ body });
  }

  getInlineComments(): InlineComment[] {
    return [...this.inlineComments];
  }

  getGeneralComments(): GeneralComment[] {
    return [...this.generalComments];
  }

  getReviewSummary(): string {
    const generalText = this.generalComments.map(c => c.body).join('\n\n');
    
    if (!generalText) {
      return 'Code review completed.';
    }
    
    return generalText;
  }

  hasComments(): boolean {
    return this.inlineComments.length > 0 || this.generalComments.length > 0;
  }

  clear(): void {
    this.inlineComments = [];
    this.generalComments = [];
  }
}

// Global collectors keyed by session ID for concurrent reviews
const activeCollectors = new Map<string, ReviewCommentCollector>();

export function startReviewSession(sessionId: string): ReviewCommentCollector {
  const collector = new ReviewCommentCollector();
  activeCollectors.set(sessionId, collector);
  console.log(`Started review session: ${sessionId}`);
  return collector;
}

export function getCurrentCollector(sessionId: string): ReviewCommentCollector {
  const collector = activeCollectors.get(sessionId);
  if (!collector) {
    throw new Error(`No active review session found for ID: ${sessionId}. Call startReviewSession() first.`);
  }
  return collector;
}

export function endReviewSession(sessionId: string): ReviewCommentCollector {
  const collector = activeCollectors.get(sessionId);
  if (!collector) {
    throw new Error(`No active review session found for ID: ${sessionId}.`);
  }
  activeCollectors.delete(sessionId);
  console.log(`Ended review session: ${sessionId}`);
  return collector;
}
