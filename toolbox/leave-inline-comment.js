#!/usr/bin/env node

import fs from 'fs';

const action = process.env.TOOLBOX_ACTION;

if (action === 'describe') {
  console.log(JSON.stringify({
    name: 'leave_inline_comment',
    description: 'Leave inline comments on specific lines in pull requests. Can optionally include suggested fixes for trivial changes.',
    args: {
      message: ['string', 'The comment message explaining the issue or feedback'],
      path: ['string', 'File path for the inline comment'],
      line: ['number', 'Line number for the inline comment'],
      suggested_fix: ['string', 'Optional code suggestion to replace the current line(s). Only provide this for obvious/trivial fixes. The suggestion should be the exact replacement code without any markdown formatting.']
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
    if (!args.message || !args.path || typeof args.line !== 'number') {
      throw new Error('Missing required arguments: message, path, line');
    }

    const comment = {
      type: 'inline',
      message: args.message,
      path: args.path,
      line: args.line,
      ...(args.suggested_fix && { suggested_fix: args.suggested_fix })
    };

    const jsonLine = JSON.stringify(comment) + '\n';
    fs.appendFileSync(commentsFile, jsonLine, 'utf8');
    
    console.log(`Collecting inline comment for later review: ${args.path}:${args.line} hasSuggestion=${!!args.suggested_fix}`);
    console.log(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Failed to collect inline comment:', error.message);
    console.log(JSON.stringify({ success: false, error: error.message }));
  }
}
