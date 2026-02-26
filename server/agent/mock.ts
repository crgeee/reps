import Anthropic from "@anthropic-ai/sdk";
import sql from "../db/client.js";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-6";

// --- Types ---

export interface MockScore {
  clarity: number;
  depth: number;
  correctness: number;
  communication: number;
  overall: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface MockMessage {
  role: "interviewer" | "candidate";
  content: string;
}

interface MockSession {
  id: string;
  collectionId: string | null;
  topic: string;
  difficulty: string;
  messages: MockMessage[];
  score: MockScore | null;
  startedAt: string;
  completedAt: string | null;
}

interface SessionRow {
  id: string;
  collection_id: string | null;
  topic: string;
  difficulty: string;
  messages: string | MockMessage[];
  score: string | MockScore | null;
  started_at: string;
  completed_at: string | null;
}

// --- Constants ---

const TOPIC_PROMPTS: Record<string, string> = {
  coding:
    "Ask a specific coding problem with constraints. Frame it like an Anthropic engineer would — focus on algorithmic thinking, edge cases, and clean design.",
  "system-design":
    "Ask a system design question with specific scale requirements. Frame it like an Anthropic architect would — emphasize reliability, scalability, and trade-offs.",
  behavioral:
    "Ask a behavioral interview question in STAR format tied to Anthropic's AI safety values. Focus on leadership, impact, and ethical decision-making.",
  papers:
    "Ask a discussion question about a recent AI/ML paper relevant to Anthropic's mission. Focus on practical implications and safety considerations.",
  custom:
    "Ask a thoughtful technical interview question appropriate for a senior software engineer.",
};

const DIFFICULTY_MODIFIERS: Record<string, string> = {
  easy: "Keep it at a mid-level engineer level. Straightforward with clear constraints.",
  medium: "Target senior engineer level. Include nuance and require trade-off analysis.",
  hard: "Target staff+ engineer level. Require deep expertise, handle ambiguity, and explore edge cases.",
};

const DEFAULT_FALLBACK_SCORE: MockScore = {
  clarity: 3,
  depth: 3,
  correctness: 3,
  communication: 3,
  overall: 3,
  feedback: "Unable to generate detailed evaluation. Review your answers for completeness.",
  strengths: ["Completed the interview"],
  improvements: ["Try again for a detailed evaluation"],
};

// --- Helpers ---

function rowToSession(row: SessionRow): MockSession {
  return {
    id: row.id,
    collectionId: row.collection_id,
    topic: row.topic,
    difficulty: row.difficulty,
    messages:
      typeof row.messages === "string"
        ? (JSON.parse(row.messages) as MockMessage[])
        : (row.messages as MockMessage[]),
    score: row.score
      ? typeof row.score === "string"
        ? (JSON.parse(row.score) as MockScore)
        : (row.score as MockScore)
      : null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function parseScoreJson(text: string): MockScore {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(stripped) as Partial<MockScore>;

  return {
    clarity: typeof parsed.clarity === "number" ? parsed.clarity : 3,
    depth: typeof parsed.depth === "number" ? parsed.depth : 3,
    correctness: typeof parsed.correctness === "number" ? parsed.correctness : 3,
    communication: typeof parsed.communication === "number" ? parsed.communication : 3,
    overall: typeof parsed.overall === "number" ? parsed.overall : 3,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "No feedback provided.",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
  };
}

// --- Exports ---

export async function startMockInterview(
  topic: string,
  difficulty: string,
  collectionId?: string,
  userId?: string,
): Promise<{ sessionId: string; question: string }> {
  const topicPrompt = TOPIC_PROMPTS[topic] ?? TOPIC_PROMPTS["custom"]!;
  const difficultyMod = DIFFICULTY_MODIFIERS[difficulty] ?? DIFFICULTY_MODIFIERS["medium"]!;

  let question: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: `You are a senior Anthropic interviewer conducting a mock technical interview. ${difficultyMod} Generate a single interview question only — no preamble, no "Here's a question for you", just the question itself.`,
      messages: [{ role: "user", content: topicPrompt }],
    });
    question =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "Tell me about a challenging technical problem you've solved recently.";
  } catch (err) {
    console.error("[mock] Failed to generate opening question:", err);
    question = "Tell me about a challenging technical problem you've solved recently.";
  }

  const messages: MockMessage[] = [{ role: "interviewer", content: question }];

  const [row] = await sql<SessionRow[]>`
    INSERT INTO mock_sessions (collection_id, topic, difficulty, messages, user_id)
    VALUES (${collectionId ?? null}, ${topic}, ${difficulty}, ${JSON.stringify(messages)}::jsonb, ${userId ?? null})
    RETURNING *
  `;

  if (!row) throw new Error("Failed to create mock session");

  try {
    await sql`
      INSERT INTO agent_logs (type, input, output)
      VALUES ('mock_question', ${topic}, ${question})
    `;
  } catch (err) {
    console.error("[mock] Failed to log question:", err);
  }

  return { sessionId: row.id, question };
}

export async function respondToMock(
  sessionId: string,
  answer: string,
): Promise<{ followUp?: string; evaluation?: MockScore }> {
  const [row] = await sql<SessionRow[]>`SELECT * FROM mock_sessions WHERE id = ${sessionId}`;
  if (!row) throw new Error("Session not found");

  const session = rowToSession(row);
  const messages: MockMessage[] = [
    ...session.messages,
    { role: "candidate", content: answer },
  ];

  const candidateResponses = messages.filter((m) => m.role === "candidate").length;
  const shouldEvaluate = candidateResponses >= 3;

  const conversationText = messages
    .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`)
    .join("\n\n");

  if (shouldEvaluate) {
    let score: MockScore;
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: `You are a senior Anthropic interviewer. Evaluate this mock interview. Return JSON only with this exact schema:
{ "clarity": 1-5, "depth": 1-5, "correctness": 1-5, "communication": 1-5, "overall": 1-5, "feedback": "string", "strengths": ["string"], "improvements": ["string"] }`,
        messages: [{ role: "user", content: conversationText }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      score = parseScoreJson(text);
    } catch (err) {
      console.error("[mock] Evaluation failed:", err);
      score = { ...DEFAULT_FALLBACK_SCORE };
    }

    await sql`
      UPDATE mock_sessions
      SET
        messages = ${JSON.stringify(messages)}::jsonb,
        score = ${JSON.stringify(score)}::jsonb,
        completed_at = now()
      WHERE id = ${sessionId}
    `;

    try {
      await sql`
        INSERT INTO agent_logs (type, input, output)
        VALUES ('mock_evaluation', ${sessionId}, ${JSON.stringify(score)})
      `;
    } catch (err) {
      console.error("[mock] Failed to log evaluation:", err);
    }

    return { evaluation: score };
  }

  // Generate follow-up question (rounds 1-2)
  let followUp: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "You are a senior Anthropic interviewer conducting a mock interview. Based on the candidate's response, ask a probing follow-up question that goes deeper. Just the question, no preamble.",
      messages: [{ role: "user", content: conversationText }],
    });
    followUp =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "Can you elaborate on that?";
  } catch (err) {
    console.error("[mock] Follow-up generation failed:", err);
    followUp = "Can you elaborate on your approach and discuss potential trade-offs?";
  }

  messages.push({ role: "interviewer", content: followUp });

  await sql`
    UPDATE mock_sessions
    SET messages = ${JSON.stringify(messages)}::jsonb
    WHERE id = ${sessionId}
  `;

  return { followUp };
}

export async function getInterleaveTopicForMock(collectionId?: string, userId?: string): Promise<string> {
  const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;
  const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;

  try {
    const [row] = await sql<{ topic: string }[]>`
      SELECT topic FROM tasks
      WHERE completed = false ${collectionFilter} ${userFilter}
      GROUP BY topic
      ORDER BY AVG(ease_factor) ASC, MAX(last_reviewed) ASC NULLS FIRST
      LIMIT 1
    `;
    return row?.topic ?? "coding";
  } catch (err) {
    console.error("[mock] getInterleaveTopicForMock failed:", err);
    return "coding";
  }
}

export async function getMockSession(sessionId: string, userId?: string): Promise<MockSession | null> {
  try {
    const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;
    const [row] = await sql<SessionRow[]>`SELECT * FROM mock_sessions WHERE id = ${sessionId} ${userFilter}`;
    return row ? rowToSession(row) : null;
  } catch (err) {
    console.error("[mock] getMockSession failed:", err);
    return null;
  }
}

export async function listMockSessions(collectionId?: string, userId?: string): Promise<MockSession[]> {
  try {
    const userFilter = userId ? sql`AND user_id = ${userId}` : sql``;
    const collectionFilter = collectionId ? sql`AND collection_id = ${collectionId}` : sql``;
    const rows = await sql<SessionRow[]>`
      SELECT * FROM mock_sessions WHERE 1=1 ${userFilter} ${collectionFilter}
      ORDER BY started_at DESC LIMIT 50
    `;
    return rows.map(rowToSession);
  } catch (err) {
    console.error("[mock] listMockSessions failed:", err);
    return [];
  }
}
