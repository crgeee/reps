import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import tasks from "./routes/tasks.js";
import agent from "./routes/agent.js";
import collections from "./routes/collections.js";
import tags from "./routes/tags.js";
import statsRoutes from "./routes/stats.js";

// Import and start cron jobs
import { startCronJobs } from "./cron.js";
startCronJobs();

const app = new Hono();

// CORS — restrict to our domain
app.use(
  "/*",
  cors({
    origin: ["https://reps-prep.duckdns.org"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  })
);

// Body size limit — 1MB default
app.use("/*", bodyLimit({ maxSize: 1024 * 1024 }));

// Global rate limit — 100 req/min
app.use("/*", rateLimiter(100, 60_000));

// Health check (no auth required)
app.get("/health", (c) => c.json({ status: "ok" }));

// Apply auth middleware to all API routes
app.use("/*", authMiddleware);

// Stricter rate limit for agent routes — 10 req/min
app.use("/agent/*", rateLimiter(10, 60_000));

// Mount routes
app.route("/tasks", tasks);
app.route("/agent", agent);
app.route("/collections", collections);
app.route("/tags", tags);
app.route("/stats", statsRoutes);

const port = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`reps server listening on port ${port}`);
});

export default app;
