import cron from "node-cron";
import { dailyBriefing, weeklyInsight } from "./agent/coach.js";
import { sendDailyDigest } from "./agent/email.js";

export function startCronJobs(): void {
  // Daily briefing + email digest at 8:00 AM every day
  cron.schedule("0 8 * * *", async () => {
    console.log("[cron] Running daily briefing...");
    try {
      await dailyBriefing();
      console.log("[cron] Daily briefing complete.");
    } catch (err) {
      console.error("[cron] Daily briefing failed:", err);
    }

    console.log("[cron] Sending daily digest email...");
    try {
      await sendDailyDigest();
      console.log("[cron] Daily digest sent.");
    } catch (err) {
      console.error("[cron] Daily digest failed:", err);
    }
  });

  // Weekly insight at 8:00 PM every Sunday
  cron.schedule("0 20 * * 0", async () => {
    console.log("[cron] Running weekly insight...");
    try {
      await weeklyInsight();
      console.log("[cron] Weekly insight complete.");
    } catch (err) {
      console.error("[cron] Weekly insight failed:", err);
    }
  });

  console.log("[cron] Scheduled: daily briefing + digest (8:00 AM), weekly insight (Sun 8:00 PM)");
}
