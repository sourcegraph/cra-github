import { writeFileSync, appendFileSync } from 'fs';

export interface CommentData {
  type: 'inline' | 'general';
  message: string;
  path?: string;    // Only for inline comments
  line?: number;    // Only for inline comments
  suggested_fix?: string; // Only for inline comments
}

export class FileBasedCommentCollector {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    // Initialize empty file
    writeFileSync(this.filePath, '', 'utf8');
  }

  addInlineComment(path: string, line: number, message: string, suggested_fix?: string): void {
    const comment: CommentData = {
      type: 'inline',
      message,
      path,
      line,
      suggested_fix
    };

    this.appendComment(comment);
  }

  addGeneralComment(message: string): void {
    const comment: CommentData = {
      type: 'general',
      message
    };

    this.appendComment(comment);
  }

  private appendComment(comment: CommentData): void {
    const jsonLine = JSON.stringify(comment) + '\n';
    appendFileSync(this.filePath, jsonLine, 'utf8');
  }
}

// Global collector instance for the MCP server
let globalCollector: FileBasedCommentCollector | null = null;

export function initializeCollector(): FileBasedCommentCollector | null {
  const commentsFile = process.env.COMMENTS_FILE;

  if (!commentsFile) {
    console.error('No COMMENTS_FILE environment variable, collector not initialized');
    return null;
  }

  try {
    globalCollector = new FileBasedCommentCollector(commentsFile);
    console.error('Comment collector initialized with file:', commentsFile);
    return globalCollector;
  } catch (error) {
    console.error('Failed to initialize comment collector:', error);
    return null;
  }
}

export function getCollector(): FileBasedCommentCollector | null {
  return globalCollector;
}
