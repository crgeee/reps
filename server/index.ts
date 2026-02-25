import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { authMiddleware } from "./middleware/auth.js";
import tasks from "./routes/tasks.js";
import agent from "./routes/agent.js";

// Import and start cron jobs
import { startCronJobs } from "./cron.js";
startCronJobs();

const app = new Hono();

// Health check (no auth required)
app.get("/health", (c) => c.json({ status: "ok" }));

// Apply auth middleware to all API routes
app.use("/*", authMiddleware);

// Mount routes
app.route("/tasks", tasks);
app.route("/agent", agent);

const port = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`reps server listening on port ${port}`);
});

export default app;
