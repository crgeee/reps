import Anthropic from "@anthropic-ai/sdk";
import sql from "../db/client.js";
import { send } from "./notify.js";
import { getDailyBriefingData } from "./shared.js";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-6";

export async function dailyBriefing(): Promise<string> {
  const data = await getDailyBriefingData();

  const dueList =
    data.dueToday.length > 0
      ? data.dueToday.map((t) => `- [${t.topic}] ${t.title} (due: ${t.nextReview})`).join("\n")
      : "No reviews due today.";

  const deadlineList =
    data.upcomingDeadlines.length > 0
      ? data.upcomingDeadlines
          .map((t) => `- [${t.topic}] ${t.title} (deadline: ${t.deadline})`)
          .join("\n")
      : "No upcoming deadlines.";

  const streakLine =
    data.streak.current > 0
      ? `Current streak: ${data.streak.current} day${data.streak.current === 1 ? "" : "s"}.`
      : "No active streak.";

  const userPrompt = `Reviews due today:\n${dueList}\n\nUpcoming deadlines (next 7 days):\n${deadlineList}\n\n${streakLine}`;

  let message: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "You are a technical interview coach. The candidate is preparing for a software engineer role at Anthropic. Given these due review items and upcoming deadlines, write a 3-sentence motivating and specific coaching message for today. Be direct, not cheesy.",
      messages: [{ role: "user", content: userPrompt }],
    });

    message =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Unable to generate briefing.";
  } catch (err) {
    console.error("[coach] dailyBriefing Claude error:", err);
    message = `You have ${data.dueToday.length} review(s) due and ${data.upcomingDeadlines.length} upcoming deadline(s). Check your reps dashboard.`;
  }

  await send("reps — daily briefing", message);

  try {
    await sql`
      INSERT INTO agent_logs (type, input, output)
      VALUES ('daily_briefing', ${userPrompt}, ${message})
    `;
  } catch (err) {
    console.error("[coach] Failed to log daily briefing:", err);
  }

  return message;
}

export async function weeklyInsight(): Promise<string> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  const reviewHistory = await sql<{
    topic: string;
    review_count: string;
    avg_ease: string;
    avg_reps: string;
  }[]>`
    SELECT
      topic,
      COUNT(*)::text AS review_count,
      ROUND(AVG(ease_factor)::numeric, 2)::text AS avg_ease,
      ROUND(AVG(repetitions)::numeric, 1)::text AS avg_reps
    FROM tasks
    WHERE last_reviewed IS NOT NULL AND last_reviewed >= ${cutoff}
    GROUP BY topic
    ORDER BY topic
  `;

  const historyText =
    reviewHistory.length > 0
      ? reviewHistory
          .map(
            (r) =>
              `${r.topic}: ${r.review_count} reviews, avg ease ${r.avg_ease}, avg reps ${r.avg_reps}`,
          )
          .join("\n")
      : "No review activity in the last 30 days.";

  const userPrompt = `Review history (last 30 days):\n${historyText}`;

  let message: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        "You are a technical interview coach. The candidate is preparing for a software engineer role at Anthropic. Given this 30-day review history by topic, identify the weakest topic and suggest one concrete focus area for the coming week. Be specific and actionable in 3-4 sentences.",
      messages: [{ role: "user", content: userPrompt }],
    });

    message =
      response.content[0].type === "text"
        ? response.content[0].text
        : "Unable to generate insight.";
  } catch (err) {
    console.error("[coach] weeklyInsight Claude error:", err);
    message =
      "Could not generate weekly insight. Review your topic progress in the dashboard.";
  }

  await send("reps — weekly insight", message);

  try {
    await sql`
      INSERT INTO agent_logs (type, input, output)
      VALUES ('weekly_insight', ${userPrompt}, ${message})
    `;
  } catch (err) {
    console.error("[coach] Failed to log weekly insight:", err);
  }

  return message;
}
