import Anthropic from "@anthropic-ai/sdk";
import sql from "../db/client.js";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-6";

export interface EvaluationResult {
  clarity: number;
  specificity: number;
  missionAlignment: number;
  feedback: string;
  suggestedImprovement: string;
}

interface TaskRow {
  id: string;
  topic: string;
  title: string;
}

interface NoteRow {
  id: string;
  task_id: string;
  text: string;
  created_at: string;
}

export async function evaluateAnswer(
  taskId: string,
  answer: string
): Promise<EvaluationResult> {
  const [task] = await sql<TaskRow[]>`
    SELECT id, topic, title FROM tasks WHERE id = ${taskId}
  `;

  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const noteRows = await sql<NoteRow[]>`
    SELECT id, task_id, text, created_at FROM notes
    WHERE task_id = ${taskId}
    ORDER BY created_at ASC
  `;

  const notesContext = noteRows.length > 0
    ? `\n\nExisting notes on this task:\n${noteRows.map((n) => `- ${n.text}`).join("\n")}`
    : "";

  const userPrompt = `Task: [${task.topic}] ${task.title}${notesContext}\n\nCandidate's answer:\n${answer}`;

  const systemPrompt = `You are a senior Anthropic interviewer. Score the candidate's answer on:
- clarity (1-5): How clear and well-structured is the response?
- specificity (1-5): How specific and detailed is the response?
- missionAlignment (1-5): How well does the response align with AI safety values and Anthropic's mission?

For behavioral questions, also check for STAR format (Situation, Task, Action, Result).

Return JSON only with this exact structure:
{ "clarity": <number>, "specificity": <number>, "missionAlignment": <number>, "feedback": "<string>", "suggestedImprovement": "<string>" }

Do not include any text outside the JSON object.`;

  let result: EvaluationResult;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    try {
      // Extract JSON from response — handle possible markdown fences
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);

      result = {
        clarity: clampScore(parsed.clarity),
        specificity: clampScore(parsed.specificity),
        missionAlignment: clampScore(parsed.missionAlignment),
        feedback: String(parsed.feedback || "No feedback provided."),
        suggestedImprovement: String(parsed.suggestedImprovement || "No suggestion provided."),
      };
    } catch (parseErr) {
      console.error("[evaluator] JSON parse error:", parseErr);
      result = {
        clarity: 3,
        specificity: 3,
        missionAlignment: 3,
        feedback: text || "Evaluation completed but structured scoring failed.",
        suggestedImprovement: "Try again for a more detailed evaluation.",
      };
    }
  } catch (err) {
    console.error("[evaluator] Claude error:", err);
    throw new Error("Failed to evaluate answer");
  }

  // Save feedback as a note on the task
  const today = new Date().toISOString().split("T")[0];
  const feedbackText = `[AI Evaluation] Clarity: ${result.clarity}/5, Specificity: ${result.specificity}/5, Mission Alignment: ${result.missionAlignment}/5\nFeedback: ${result.feedback}\nSuggested Improvement: ${result.suggestedImprovement}`;

  try {
    await sql`
      INSERT INTO notes (task_id, text, created_at)
      VALUES (${taskId}, ${feedbackText}, ${today})
    `;
  } catch (err) {
    console.error("[evaluator] Failed to save feedback note:", err);
  }

  // Log to agent_logs
  try {
    await sql`
      INSERT INTO agent_logs (type, task_id, input, output)
      VALUES ('evaluation', ${taskId}, ${userPrompt}, ${JSON.stringify(result)})
    `;
  } catch (err) {
    console.error("[evaluator] Failed to log evaluation:", err);
  }

  return result;
}

function clampScore(value: unknown): number {
  const num = Number(value);
  if (isNaN(num)) return 3;
  return Math.max(1, Math.min(5, Math.round(num)));
}
