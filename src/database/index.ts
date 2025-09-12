import Database from 'better-sqlite3';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Review {
  id: string;
  owner: string;
  repo: string;
  prNumber: string;
  threadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInsert {
  owner: string;
  repo: string;
  prNumber: string;
  threadId: string;
}

class ReviewDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || join(process.cwd(), 'data', 'reviews.db');
    this.db = new Database(path);
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        pr_number TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_thread_id_unique ON reviews(thread_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(owner, repo);
    `);
  }

  insertReview(review: ReviewInsert): Review {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO reviews (id, owner, repo, pr_number, thread_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, review.owner, review.repo, review.prNumber, review.threadId, now, now);
    
    return {
      id,
      ...review,
      createdAt: now,
      updatedAt: now
    };
  }

  getReviewById(id: string): Review | null {
    const stmt = this.db.prepare(`
      SELECT id, owner, repo, pr_number as prNumber, thread_id as threadId,
             created_at as createdAt, updated_at as updatedAt
      FROM reviews WHERE id = ?
    `);
    
    return stmt.get(id) as Review | null;
  }

  getReviewByThreadId(threadId: string): Review | null {
    const stmt = this.db.prepare(`
      SELECT id, owner, repo, pr_number as prNumber, thread_id as threadId,
             created_at as createdAt, updated_at as updatedAt
      FROM reviews WHERE thread_id = ?
    `);
    
    return stmt.get(threadId) as Review | null;
  }

  getReviewsByRepo(owner: string, repo: string): Review[] {
    const stmt = this.db.prepare(`
      SELECT id, owner, repo, pr_number as prNumber, thread_id as threadId,
             created_at as createdAt, updated_at as updatedAt
      FROM reviews WHERE owner = ? AND repo = ?
      ORDER BY created_at DESC
    `);
    
    return stmt.all(owner, repo) as Review[];
  }

  getReviewsByPR(owner: string, repo: string, prNumber: string): Review[] {
    const stmt = this.db.prepare(`
      SELECT id, owner, repo, pr_number as prNumber, thread_id as threadId,
             created_at as createdAt, updated_at as updatedAt
      FROM reviews WHERE owner = ? AND repo = ? AND pr_number = ?
      ORDER BY created_at DESC
    `);
    
    return stmt.all(owner, repo, prNumber) as Review[];
  }

  getLatestReviewByPR(owner: string, repo: string, prNumber: string): Review | null {
    const stmt = this.db.prepare(`
      SELECT id, owner, repo, pr_number as prNumber, thread_id as threadId,
             created_at as createdAt, updated_at as updatedAt
      FROM reviews WHERE owner = ? AND repo = ? AND pr_number = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    return stmt.get(owner, repo, prNumber) as Review | null;
  }

  close() {
    this.db.close();
  }
}

export const reviewDb = new ReviewDatabase();
