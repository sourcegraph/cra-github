import { Hono, Context, Next } from "hono";
import { cors } from "hono/cors";
import { getConfig, Config } from "../config.js";
import { leaveGeneralComment } from "./tools/leave_comment.js";
import { leaveInlineComment } from "./tools/leave_inline_comment.js";
import { getPRComments } from "./tools/get_pr_comments.js";
import {
  validateLeaveGeneralCommentArgs,
  validateLeaveInlineCommentArgs,
  validateGetPRCommentsArgs,
} from "./validation.js";

export function createMCPRoutes(): Hono {
  const app = new Hono();
  const config = getConfig();

  // CORS middleware for MCP endpoints
  app.use(
    "*",
    cors({
      origin: ["*"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Middleware to validate Authorization header
  const authMiddleware = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    const expectedToken = process.env.MCP_AUTH_TOKEN;

    if (!expectedToken) {
      console.warn("⚠️  MCP_AUTH_TOKEN not set, skipping auth check");
      await next();
      return;
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ Missing or invalid Authorization header");
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (token !== expectedToken) {
      console.log("❌ Token mismatch");
      return c.json({ error: "Invalid token" }, 401);
    }

    console.log("✅ Authentication successful");
    await next();
  };

  app.use("*", authMiddleware);

  // Debug middleware to log all requests
  app.use("*", async (c, next) => {
    console.log(`📮 ${c.req.method} ${c.req.url} - Content-Type: ${c.req.header("Content-Type")} - Accept: ${c.req.header("Accept")}`);
    await next();
  });


  // Main MCP endpoint for JSON-RPC messages
  app.post("/", async (c) => {
    try {
      console.log("📨 POST request to MCP endpoint");
      console.log("📋 Method:", c.req.method);
      console.log("📋 URL:", c.req.url);

      // Check Accept header as per MCP spec
      const acceptHeader = c.req.header("Accept");
      console.log("🎯 Accept header:", acceptHeader);

      const body = await c.req.json();
      console.log("🔍 Received MCP request:", JSON.stringify(body, null, 2));

      const bodyObj = body as Record<string, unknown>;

      // Handle JSON-RPC request
      if (bodyObj.jsonrpc !== "2.0") {
        console.log("❌ Invalid JSON-RPC version:", bodyObj.jsonrpc);
        return c.json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid Request" },
          id: bodyObj.id || null
        }, 400);
      }

      console.log("📋 Method:", bodyObj.method, "ID:", bodyObj.id);
      switch (bodyObj.method) {
        case "initialize":
          console.log("🔧 Handling initialize");
          return handleInitialize(c, body);
        case "notifications/initialized":
          console.log("🔧 Handling notifications/initialized");
          return handleInitializedNotification(c, body);
        case "tools/list":
          console.log("🔧 Handling tools/list");
          return handleToolsList(c, body);
        case "tools/call":
          console.log("🔧 Handling tools/call");
          return handleToolsCall(c, body, config);
        default:
          console.log("❌ Unknown method:", body.method);
          return c.json({
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not found" },
            id: bodyObj.id || null
          }, 400);
      }
    } catch (error) {
      console.error("Error processing JSON-RPC request:", error);
      return c.json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null
      }, 500);
    }
  });

  // SSE endpoint for server-to-client communication
  app.get("/", async (c) => {
    console.log("📡 GET request to MCP endpoint - establishing SSE stream");
    console.log("🎯 Accept header:", c.req.header("Accept"));

    // Check if client accepts text/event-stream
    const acceptHeader = c.req.header("Accept");
    if (!acceptHeader || !acceptHeader.includes("text/event-stream")) {
      console.log("❌ Client doesn't accept text/event-stream");
      return c.json({ error: "SSE not supported by client" }, 405);
    }

    // Set up SSE headers
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    c.header("Access-Control-Allow-Origin", "*");

    console.log("✅ SSE stream established");

    // Return a basic SSE response that keeps connection open
    // The actual JSON-RPC messages will come via POST requests
    return c.text("data: connected\n\n", 200);
  });

  return app;
}

function handleInitialize(c: Context, body: unknown) {
  try {
    const bodyObj = body as Record<string, unknown>;
    console.log("🚀 Initializing MCP server with params:", bodyObj.params);

    return c.json({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "github-code-review-agent",
          version: "2.0.0"
        }
      },
      id: bodyObj.id
    });
  } catch (error) {
    console.error("Error during initialization:", error);
    return c.json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal error" },
      id: (body as Record<string, unknown>).id || null
    }, 500);
  }
}

function handleInitializedNotification(c: Context, body: unknown) {
  try {
    console.log("📢 Received initialized notification");
    // Notifications don't require a response, but we return 202 Accepted
    return c.text("", 202);
  } catch (error) {
    console.error("Error handling initialized notification:", error);
    return c.json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal error" },
      id: (body as Record<string, unknown>).id || null
    }, 500);
  }
}

function handleToolsList(c: Context, body: unknown) {
  try {
    console.log("📋 Listing tools for request ID:", (body as Record<string, unknown>).id);
    const tools = [
      {
        name: "leave_general_comment",
        description: "Leave general comments on pull requests",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The comment message",
            },
            owner: {
              type: "string",
              description: "Repository owner",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
            pr_number: {
              type: "number",
              description: "Pull request number",
            },
          },
          required: ["message", "owner", "repo", "pr_number"],
        },
      },
      {
        name: "leave_inline_comment",
        description: "Leave inline comments on specific lines in pull requests",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The comment message",
            },
            owner: {
              type: "string",
              description: "Repository owner",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
            pr_number: {
              type: "number",
              description: "Pull request number",
            },
            path: {
              type: "string",
              description: "File path for the inline comment",
            },
            line: {
              type: "number",
              description: "Line number for the inline comment",
            },
            commit_sha: {
              type: "string",
              description: "Commit SHA (optional - will be fetched if not provided)",
            },
          },
          required: ["message", "owner", "repo", "pr_number", "path", "line"],
        },
      },
      {
        name: "get_pr_comments",
        description: "Get all comments on a pull request",
        inputSchema: {
          type: "object",
          properties: {
            owner: {
              type: "string",
              description: "Repository owner",
            },
            repo: {
              type: "string",
              description: "Repository name",
            },
            pr_number: {
              type: "number",
              description: "Pull request number",
            },
          },
          required: ["owner", "repo", "pr_number"],
        },
      },
    ];

    console.log("📋 Returning tools list with", tools.length, "tools");
    return c.json({
      jsonrpc: "2.0",
      result: { tools },
      id: (body as Record<string, unknown>).id
    });
  } catch (error) {
    console.error("Error listing tools:", error);
    return c.json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal error" },
      id: (body as Record<string, unknown>).id || null
    }, 500);
  }
}

async function handleToolsCall(c: Context, body: unknown, config: Config) {
  const bodyObj = body as Record<string, unknown>;
  try {
    console.log("🔧 Tool call params:", JSON.stringify(bodyObj.params, null, 2));
    const { name, arguments: args } = (bodyObj.params as Record<string, unknown>) || {};

    if (!name) {
      console.log("❌ Missing tool name in params");
      return c.json({
        jsonrpc: "2.0",
        error: { code: -32602, message: "Invalid params: missing tool name" },
        id: bodyObj.id || null
      }, 400);
    }

    console.log("🎯 Calling tool:", name, "with args:", JSON.stringify(args, null, 2));

    let result;
    switch (name) {
      case "leave_general_comment":
        result = await leaveGeneralComment(
          validateLeaveGeneralCommentArgs(args),
          config
        );
        break;

      case "leave_inline_comment":
        console.log("🎯 Handling leave_inline_comment with args:", JSON.stringify(args, null, 2));
        try {
          const validatedArgs = validateLeaveInlineCommentArgs(args);
          console.log("✅ Args validated successfully:", JSON.stringify(validatedArgs, null, 2));
          result = await leaveInlineComment(
            validatedArgs,
            config
          );
        } catch (validationError) {
          console.log("❌ Validation error:", validationError);
          throw validationError;
        }
        break;


      case "get_pr_comments":
        result = await getPRComments(
          validateGetPRCommentsArgs(args),
          config
        );
        break;

      default:
        return c.json({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Unknown tool: ${name}` },
          id: bodyObj.id || null
        }, 400);
    }

    console.log("✅ Tool call successful, result:", JSON.stringify(result, null, 2));
    return c.json({
      jsonrpc: "2.0",
      result,
      id: bodyObj.id
    });
  } catch (error) {
    console.error("Error calling tool:", error);
    return c.json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Unknown error"
      },
      id: bodyObj.id || null
    }, 500);
  }
}
