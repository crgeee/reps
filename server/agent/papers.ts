import Anthropic from "@anthropic-ai/sdk";
import sql from "../db/client.js";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-6";

export interface PaperSummary {
  summary: string;
  talkingPoints: string[];
  keyTerms: string[];
}

interface NoteRow {
  id: string;
  task_id: string;
  text: string;
  created_at: string;
}

const URL_REGEX = /https?:\/\/[^\s),]+/;

export async function summarizePaper(taskId: string): Promise<PaperSummary> {
  const [task] = await sql<{ id: string; title: string }[]>`
    SELECT id, title FROM tasks WHERE id = ${taskId}
  `;

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const noteRows = await sql<NoteRow[]>`
    SELECT id, task_id, text, created_at FROM notes
    WHERE task_id = ${taskId}
    ORDER BY created_at ASC
  `;

  // Find first URL in notes
  let paperUrl: string | null = null;
  for (const note of noteRows) {
    const match = note.text.match(URL_REGEX);
    if (match) {
      paperUrl = match[0];
      break;
    }
  }

  if (!paperUrl) {
    throw new Error("No URL found in task notes");
  }

  // SSRF protection: only allow HTTPS to public hosts
  try {
    const parsed = new URL(paperUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed");
    }
    const host = parsed.hostname;
    if (
      host === "localhost" ||
      host === "[::1]" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new Error("Private/internal URLs are not allowed");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("not allowed")) throw err;
    throw new Error("Invalid URL");
  }

  // Fetch the URL content
  let content: string;
  try {
    const res = await fetch(paperUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    content = await res.text();
    // Truncate to avoid exceeding context limits
    if (content.length > 50000) {
      content = content.substring(0, 50000) + "\n\n[Content truncated]";
    }
  } catch (err) {
    console.error("[papers] Failed to fetch URL:", err);
    throw new Error(`Failed to fetch paper from ${paperUrl}`);
  }

  const systemPrompt = `Summarize this paper for an engineer preparing for an Anthropic interview. Return JSON only with this exact structure:
{ "summary": "<string with 5 bullet points, each on a new line starting with •>", "talkingPoints": ["<point1>", "<point2>", "<point3>"], "keyTerms": ["<term1>", "<term2>", ...] }

Do not include any text outside the JSON object.`;

  const userPrompt = `Paper: ${task.title}\nURL: ${paperUrl}\n\nContent:\n${content}`;

  let result: PaperSummary;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);

      result = {
        summary: String(parsed.summary || "No summary generated."),
        talkingPoints: Array.isArray(parsed.talkingPoints)
          ? parsed.talkingPoints.map(String)
          : [],
        keyTerms: Array.isArray(parsed.keyTerms)
          ? parsed.keyTerms.map(String)
          : [],
      };
    } catch (parseErr) {
      console.error("[papers] JSON parse error:", parseErr);
      result = {
        summary: text || "Summary generation failed to produce structured output.",
        talkingPoints: [],
        keyTerms: [],
      };
    }
  } catch (err) {
    console.error("[papers] Claude error:", err);
    throw new Error("Failed to summarize paper");
  }

  // Save summary as a note
  const today = new Date().toISOString().split("T")[0];
  const noteText = `[AI Paper Summary]\n${result.summary}\n\nTalking Points:\n${result.talkingPoints.map((p) => `• ${p}`).join("\n")}\n\nKey Terms: ${result.keyTerms.join(", ")}`;

  try {
    await sql`
      INSERT INTO notes (task_id, text, created_at)
      VALUES (${taskId}, ${noteText}, ${today})
    `;
  } catch (err) {
    console.error("[papers] Failed to save summary note:", err);
  }

  // Log to agent_logs
  try {
    await sql`
      INSERT INTO agent_logs (type, task_id, input, output)
      VALUES ('paper_summary', ${taskId}, ${paperUrl}, ${JSON.stringify(result)})
    `;
  } catch (err) {
    console.error("[papers] Failed to log paper summary:", err);
  }

  return result;
}
