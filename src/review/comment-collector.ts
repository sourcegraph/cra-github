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

// Global collector instance for the current review session
let currentCollector: ReviewCommentCollector | null = null;

export function startReviewSession(): ReviewCommentCollector {
  currentCollector = new ReviewCommentCollector();
  return currentCollector;
}

export function getCurrentCollector(): ReviewCommentCollector {
  if (!currentCollector) {
    throw new Error('No active review session. Call startReviewSession() first.');
  }
  return currentCollector;
}

export function endReviewSession(): ReviewCommentCollector {
  if (!currentCollector) {
    throw new Error('No active review session to end.');
  }
  const collector = currentCollector;
  currentCollector = null;
  return collector;
}
