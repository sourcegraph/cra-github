#!/usr/bin/env node

import fs from 'fs';

const action = process.env.TOOLBOX_ACTION;

if (action === 'describe') {
  console.log(JSON.stringify({
    name: 'leave_general_comment',
    description: 'Leave general comments on pull requests',
    args: {
      message: ['string', 'The comment message']
    }
  }));
} else if (action === 'execute') {
  try {
    const args = JSON.parse(fs.readFileSync(0, 'utf-8'));
    const commentsFile = process.env.COMMENTS_FILE;
    
    if (!commentsFile) {
      throw new Error('COMMENTS_FILE environment variable not set');
    }

    // Validate required args
    if (!args.message) {
      throw new Error('Missing required argument: message');
    }

    const comment = {
      type: 'general',
      message: args.message
    };

    const jsonLine = JSON.stringify(comment) + '\n';
    fs.appendFileSync(commentsFile, jsonLine, 'utf8');
    
    console.error('Collecting general comment for later review');
    console.log(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Failed to collect general comment:', error.message);
    console.log(JSON.stringify({ success: false, error: error.message }));
  }
}
