#!/usr/bin/env node
import { reviewDb } from '../dist/database/index.js';

console.log('📊 Reviews Database Viewer\n');

try {
  // Get all reviews (you can modify this query)
  const stmt = reviewDb.db.prepare(`
    SELECT id, owner, repo, pr_number, thread_id, created_at, updated_at 
    FROM reviews 
    ORDER BY created_at DESC
  `);
  
  const reviews = stmt.all();
  
  if (reviews.length === 0) {
    console.log('No reviews found in database.');
  } else {
    console.log(`Found ${reviews.length} review(s):\n`);
    
    reviews.forEach((review, index) => {
      console.log(`${index + 1}. Review ID: ${review.id}`);
      console.log(`   Owner/Repo: ${review.owner}/${review.repo}`);
      console.log(`   PR Number: ${review.pr_number}`);
      console.log(`   Thread ID: ${review.thread_id}`);
      console.log(`   Created: ${review.created_at}`);
      console.log(`   Updated: ${review.updated_at}`);
      console.log('');
    });
  }
  
} catch (error) {
  console.error('Error reading database:', error.message);
}

reviewDb.close();
