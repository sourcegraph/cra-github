# File-Based Comment Collection System

## Overview
This implementation uses file-based inter-process communication to collect comments from MCP tools and create a single GitHub review.

## Architecture

### 1. Comment Collection (MCP Server)
- **File**: `src/mcp/comment-collector.ts`
- **Purpose**: Handles JSONL append-only writes to avoid concurrency issues
- **Format**: Each line is a JSON object with `type`, `message`, and optional `path`/`line` for inline comments

### 2. Filename Generation (Main Server)  
- **Location**: `src/review/reviewer.ts`
- **Format**: `comments-${installationId}-${prNumber}-${uuid}.jsonl`
- **Passed via**: `COMMENTS_FILE` environment variable to MCP server

### 3. MCP Tools (Collection Mode)
- **leave_general_comment**: Appends `{"type":"general","message":"..."}`
- **leave_inline_comment**: Appends `{"type":"inline","message":"...","path":"...","line":123}`
- **Fallback**: If no collector available, logs warning but continues

### 4. Review Creation (Main Server)
- **Location**: `src/github/process-review.ts`  
- **Process**: 
  1. Reads JSONL file after Amp CLI completion
  2. Parses comment types and aggregates
  3. Creates single GitHub review with all comments
  4. Cleans up temporary file

## Data Flow

```
1. PR Event → Queue Job
2. Generate filename: comments-${installationId}-${prNumber}-${uuid}.jsonl
3. Pass filename via COMMENTS_FILE env var to MCP server
4. Amp CLI executes → MCP tools append to file
5. Main server reads file → Creates GitHub review
6. Clean up temp file
```

## File Format (JSONL)

```jsonl
{"type":"inline","message":"Fix this bug","path":"src/auth.js","line":25}
{"type":"inline","message":"Add error handling","path":"src/api.js","line":10}  
{"type":"general","message":"Overall looks good, just minor issues above"}
```

## Concurrency Safety
- **appendFileSync()**: Atomic at OS level for small writes
- **JSONL format**: No read-modify-write cycles
- **Unique filenames**: Prevent collisions across jobs

## Benefits
- ✅ Simple file-based IPC 
- ✅ No complex env var passing
- ✅ Atomic review creation
- ✅ Robust error handling with cleanup
- ✅ Maintains tool abstractions
- ✅ Enables "Request re-review" button

## Error Handling
- **MCP server crash**: File remains, main server handles gracefully
- **File corruption**: JSON parsing errors logged, review skipped
- **Missing file**: Logged and skipped (no comments case)
- **Cleanup failures**: Logged but don't fail the job
