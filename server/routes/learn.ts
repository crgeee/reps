import { Hono } from 'hono';
import { z } from 'zod';
import sql from '../db/client.js';
import { calculateSM2 } from '../../src/spaced-repetition.js';
import { validateUuid } from '../validation.js';
import { runCode, ExecutionQueue, CircuitBreaker } from '../learn/docker-runner.js';
import { createCompletion } from '../agent/provider.js';
import { logger } from '../logger.js';
import type { AppEnv } from '../types.js';
import type { Quality } from '../../src/types.js';

const learn = new Hono<AppEnv>();

const executionQueue = new ExecutionQueue({ maxConcurrent: 1 });
const circuitBreaker = new CircuitBreaker({ threshold: 5, cooldownMs: 5 * 60 * 1000 });

// --- converter functions ---

export function toTrack(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string | null,
    imageUrl: (row.image_url ?? null) as string | null,
    createdAt: String(row.created_at),
    moduleCount: Number(row.module_count ?? 0),
  };
}

export function toModule(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    trackId: row.track_id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description ?? null) as string | null,
    sortOrder: row.sort_order as number,
    prerequisites: (row.prerequisites ?? []) as string[],
    concepts: (row.concepts ?? []) as string[],
    createdAt: String(row.created_at),
  };
}

export function toProgress(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    moduleId: row.module_id as string,
    status: row.status as string,
    repetitions: row.repetitions as number,
    interval: row.interval as number,
    easeFactor: row.ease_factor as number,
    nextReview: row.next_review ? String(row.next_review) : null,
    lastReviewed: row.last_reviewed ? String(row.last_reviewed) : null,
    createdAt: String(row.created_at),
  };
}

// --- feature flag middleware ---

learn.use('/*', async (c, next) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'learn.featureEnabled'`;
  // JSONB value may be boolean true or string "true"
  const enabled = row?.value === true || row?.value === 'true';
  if (!enabled) {
    return c.json({ error: 'Learning tracks feature is not enabled' }, 404);
  }
  await next();
});

// --- validation schemas ---

const reviewSchema = z.object({
  quality: z.number().int().min(0).max(5),
});

// --- routes ---

// GET /tracks — list all tracks with module count
learn.get('/tracks', async (c) => {
  const rows = await sql`
    SELECT t.*, COUNT(m.id)::text AS module_count
    FROM tracks t
    LEFT JOIN modules m ON m.track_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at ASC
  `;
  return c.json(rows.map(toTrack));
});

// GET /tracks/:slug — track detail with modules and user progress
learn.get('/tracks/:slug', async (c) => {
  const userId = c.get('userId');
  const slug = c.req.param('slug');

  const [trackRow] = await sql`
    SELECT t.*, COUNT(m.id)::text AS module_count
    FROM tracks t
    LEFT JOIN modules m ON m.track_id = t.id
    WHERE t.slug = ${slug}
    GROUP BY t.id
  `;
  if (!trackRow) {
    return c.json({ error: 'Track not found' }, 404);
  }

  const moduleRows = await sql`
    SELECT m.*
    FROM modules m
    WHERE m.track_id = ${trackRow.id}
    ORDER BY m.sort_order ASC
  `;

  const progressRows = userId
    ? await sql`
        SELECT up.*
        FROM user_progress up
        WHERE up.user_id = ${userId}
          AND up.module_id = ANY(${moduleRows.map((m) => m.id)})
      `
    : [];

  const progressByModule = new Map<string, ReturnType<typeof toProgress>>();
  for (const p of progressRows) {
    progressByModule.set(p.module_id as string, toProgress(p));
  }

  const modules = moduleRows.map((m) => ({
    ...toModule(m),
    progress: progressByModule.get(m.id as string) ?? null,
  }));

  return c.json({ ...toTrack(trackRow), modules });
});

// GET /tracks/:slug/progress — user progress for a track
learn.get('/tracks/:slug/progress', async (c) => {
  const userId = c.get('userId');
  const slug = c.req.param('slug');

  const [trackRow] = await sql`SELECT id FROM tracks WHERE slug = ${slug}`;
  if (!trackRow) {
    return c.json({ error: 'Track not found' }, 404);
  }

  const rows = await sql`
    SELECT up.*
    FROM user_progress up
    JOIN modules m ON m.id = up.module_id
    WHERE m.track_id = ${trackRow.id} AND up.user_id = ${userId}
    ORDER BY m.sort_order ASC
  `;

  return c.json(rows.map(toProgress));
});

// POST /modules/:id/start — unlock a module (check prerequisites)
learn.post('/modules/:id/start', async (c) => {
  const userId = c.get('userId');
  const moduleId = c.req.param('id');
  if (!validateUuid(moduleId)) return c.json({ error: 'Invalid module ID' }, 400);

  const [mod] = await sql`SELECT * FROM modules WHERE id = ${moduleId}`;
  if (!mod) {
    return c.json({ error: 'Module not found' }, 404);
  }

  // Check prerequisites — all must have status 'completed' in user_progress
  const prereqs = (mod.prerequisites ?? []) as string[];
  if (prereqs.length > 0) {
    const completedPrereqs = await sql`
      SELECT module_id FROM user_progress
      WHERE user_id = ${userId}
        AND module_id = ANY(${prereqs})
        AND status = 'completed'
    `;
    if (completedPrereqs.length < prereqs.length) {
      return c.json({ error: 'Prerequisites not completed' }, 403);
    }
  }

  // Upsert to 'active'
  const today = new Date().toISOString().split('T')[0];
  const [row] = await sql`
    INSERT INTO user_progress (user_id, module_id, status, next_review)
    VALUES (${userId}, ${moduleId}, 'active', ${today})
    ON CONFLICT (user_id, module_id)
    DO UPDATE SET status = 'active'
    RETURNING *
  `;

  return c.json(toProgress(row), 201);
});

// POST /modules/:id/review — SM-2 review for a module
learn.post('/modules/:id/review', async (c) => {
  const userId = c.get('userId');
  const moduleId = c.req.param('id');
  if (!validateUuid(moduleId)) return c.json({ error: 'Invalid module ID' }, 400);

  const raw = await c.req.json();
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'quality must be an integer 0-5' }, 400);
  }
  const quality = parsed.data.quality as Quality;

  const [progress] = await sql`
    SELECT * FROM user_progress
    WHERE user_id = ${userId} AND module_id = ${moduleId}
  `;
  if (!progress) {
    return c.json({ error: 'Module not started' }, 404);
  }

  // Build a minimal Task-like object for calculateSM2
  const taskLike = {
    id: progress.id as string,
    topic: 'custom' as const,
    title: '',
    notes: [],
    completed: false,
    status: 'todo' as const,
    repetitions: progress.repetitions as number,
    interval: progress.interval as number,
    easeFactor: progress.ease_factor as number,
    nextReview: progress.next_review
      ? String(progress.next_review)
      : new Date().toISOString().split('T')[0],
    createdAt: String(progress.created_at),
  };

  const sm2 = calculateSM2(taskLike, quality);
  const today = new Date().toISOString().split('T')[0];

  // Determine status: completed if quality >= 4 and repetitions >= 3
  const newStatus = sm2.repetitions >= 3 && quality >= 4 ? 'completed' : 'active';

  const [updated] = await sql`
    UPDATE user_progress SET
      repetitions = ${sm2.repetitions},
      interval = ${sm2.interval},
      ease_factor = ${sm2.easeFactor},
      next_review = ${sm2.nextReview},
      last_reviewed = ${today},
      status = ${newStatus}
    WHERE user_id = ${userId} AND module_id = ${moduleId}
    RETURNING *
  `;

  return c.json(toProgress(updated));
});

// GET /modules/:id — module details with exercises
learn.get('/modules/:id', async (c) => {
  const moduleId = c.req.param('id');
  if (!validateUuid(moduleId)) return c.json({ error: 'Invalid module ID' }, 400);

  const [mod] = await sql`SELECT * FROM modules WHERE id = ${moduleId}`;
  if (!mod) {
    return c.json({ error: 'Module not found' }, 404);
  }

  const exercises = await sql`
    SELECT * FROM exercises
    WHERE module_id = ${moduleId}
    ORDER BY difficulty ASC, created_at ASC
  `;

  return c.json({
    ...toModule(mod),
    exercises: exercises.map((e) => ({
      id: e.id,
      moduleId: e.module_id,
      type: e.type,
      prompt: e.prompt,
      starterCode: e.starter_code,
      testCode: e.test_code,
      difficulty: e.difficulty,
      generatedBy: e.generated_by,
      createdAt: String(e.created_at),
    })),
  });
});

// GET /submissions/:exerciseId — submission history (paginated, limit 20)
learn.get('/submissions/:exerciseId', async (c) => {
  const userId = c.get('userId');
  const exerciseId = c.req.param('exerciseId');
  if (!validateUuid(exerciseId)) return c.json({ error: 'Invalid exercise ID' }, 400);

  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0);

  const rows = await sql`
    SELECT * FROM submissions
    WHERE exercise_id = ${exerciseId} AND user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 20 OFFSET ${offset}
  `;

  return c.json(
    rows.map((s) => ({
      id: s.id,
      exerciseId: s.exercise_id,
      userId: s.user_id,
      userCode: s.user_code,
      stdout: s.stdout,
      stderr: s.stderr,
      passed: s.passed,
      aiFeedback: s.ai_feedback,
      score: s.score,
      executionMs: s.execution_ms,
      createdAt: String(s.created_at),
    })),
  );
});

// --- exercise generation & execution routes ---

const generateSchema = z.object({
  moduleId: z.string().uuid(),
  difficulty: z.number().int().min(1).max(3).optional().default(1),
  type: z.enum(['code', 'knowledge', 'mini-app']).optional().default('code'),
});

const codeSchema = z.object({
  code: z.string().min(1).max(65536),
});

// POST /exercises/generate — AI-generated exercise for a module
learn.post('/exercises/generate', async (c) => {
  const log = c.get('logger') ?? logger;

  const raw = await c.req.json();
  const parsed = generateSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  const { moduleId, difficulty, type } = parsed.data;

  const [mod] = await sql`
    SELECT m.*, t.title AS track_title, t.slug AS track_slug
    FROM modules m
    JOIN tracks t ON t.id = m.track_id
    WHERE m.id = ${moduleId}
  `;
  if (!mod) {
    return c.json({ error: 'Module not found' }, 404);
  }

  const credentials = c.get('aiCredentials');
  if (!credentials?.apiKey) {
    return c.json(
      {
        error:
          'AI not configured. Set ANTHROPIC_API_KEY on the server or provide X-AI-Key/X-AI-Provider headers.',
        code: 'AI_NOT_CONFIGURED',
      },
      400,
    );
  }

  const difficultyLabel = ['beginner', 'intermediate', 'advanced'][difficulty - 1];
  const concepts = (mod.concepts as string[]).join(', ');

  try {
    const aiResponse = await createCompletion({
      credentials,
      system: `You are a programming instructor creating exercises for a learning track called "${mod.track_title}". The current module is "${mod.title}" covering: ${concepts}. Generate a ${difficultyLabel} difficulty ${type} exercise. Return JSON only: { "prompt": "exercise description", "starterCode": "code template or null", "testCode": "test code or null", "hints": ["hint1", "hint2"] }`,
      messages: [
        {
          role: 'user',
          content: `Generate a ${difficultyLabel} ${type} exercise for the "${mod.title}" module.`,
        },
      ],
      maxTokens: 1000,
    });

    let exerciseData: {
      prompt: string;
      starterCode: string | null;
      testCode: string | null;
      hints: string[];
    };
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      exerciseData = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch {
      log.error({ response: aiResponse.slice(0, 500) }, 'Failed to parse AI exercise response');
      return c.json({ error: 'Failed to parse AI response' }, 502);
    }

    const [exercise] = await sql`
      INSERT INTO exercises (module_id, type, prompt, starter_code, test_code, difficulty, generated_by)
      VALUES (${moduleId}, ${type}, ${exerciseData.prompt}, ${exerciseData.starterCode ?? null}, ${exerciseData.testCode ?? null}, ${difficulty}, 'ai')
      RETURNING *
    `;

    log.info({ exerciseId: exercise.id, moduleId, type, difficulty }, 'learn:exercise:generated');

    return c.json(
      {
        id: exercise.id,
        moduleId: exercise.module_id,
        type: exercise.type,
        prompt: exercise.prompt,
        starterCode: exercise.starter_code,
        testCode: exercise.test_code,
        difficulty: exercise.difficulty,
        hints: exerciseData.hints ?? [],
        generatedBy: exercise.generated_by,
        createdAt: String(exercise.created_at),
      },
      201,
    );
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      'Exercise generation failed',
    );
    return c.json({ error: 'Exercise generation failed' }, 500);
  }
});

// POST /exercises/:id/run — execute code in Docker sandbox
learn.post('/exercises/:id/run', async (c) => {
  const log = c.get('logger') ?? logger;
  const exerciseId = c.req.param('id');
  if (!validateUuid(exerciseId)) return c.json({ error: 'Invalid exercise ID' }, 400);

  const raw = await c.req.json();
  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  if (circuitBreaker.isOpen) {
    return c.json({ error: 'Code execution temporarily unavailable', code: 'CIRCUIT_OPEN' }, 503);
  }

  if (!executionQueue.acquire()) {
    return c.json({ error: 'Execution queue full, try again shortly', code: 'QUEUE_FULL' }, 429);
  }

  // Load timeout/memory settings
  const [timeoutSetting] =
    await sql`SELECT value FROM settings WHERE key = 'learn.executionTimeoutSeconds'`;
  const [memorySetting] =
    await sql`SELECT value FROM settings WHERE key = 'learn.executionMemoryMb'`;
  const timeoutSeconds = typeof timeoutSetting?.value === 'number' ? timeoutSetting.value : 30;
  const memoryMb = typeof memorySetting?.value === 'number' ? memorySetting.value : 128;

  log.info({ exerciseId }, 'code-execution:start');

  try {
    const result = await runCode({
      code: parsed.data.code,
      timeoutSeconds,
      memoryMb,
    });

    // Only trip circuit breaker on infrastructure failures, not user code errors
    if (result.infrastructureError) {
      circuitBreaker.recordFailure();
    } else {
      circuitBreaker.recordSuccess();
    }

    log.info(
      { exerciseId, exitCode: result.exitCode, durationMs: result.durationMs },
      'code-execution:complete',
    );

    return c.json(result);
  } catch (err) {
    circuitBreaker.recordFailure();
    log.error(
      { exerciseId, error: err instanceof Error ? err.message : String(err) },
      'code-execution:error',
    );
    return c.json({ error: 'Code execution failed' }, 500);
  } finally {
    executionQueue.release();
  }
});

// POST /exercises/:id/submit — run code + AI evaluation + save submission
learn.post('/exercises/:id/submit', async (c) => {
  const log = c.get('logger') ?? logger;
  const userId = c.get('userId');
  const exerciseId = c.req.param('id');
  if (!validateUuid(exerciseId)) return c.json({ error: 'Invalid exercise ID' }, 400);

  const raw = await c.req.json();
  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }

  // Load exercise with module + track context
  const [exercise] = await sql`
    SELECT e.*, m.title AS module_title, m.concepts, t.title AS track_title
    FROM exercises e
    JOIN modules m ON m.id = e.module_id
    JOIN tracks t ON t.id = m.track_id
    WHERE e.id = ${exerciseId}
  `;
  if (!exercise) {
    return c.json({ error: 'Exercise not found' }, 404);
  }

  let stdout: string | null = null;
  let stderr: string | null = null;
  let passed: boolean | null = null;
  let executionMs: number | null = null;

  // Run code for code/mini-app types
  const exerciseType = exercise.type as string;
  if (exerciseType === 'code' || exerciseType === 'mini-app') {
    if (circuitBreaker.isOpen) {
      return c.json({ error: 'Code execution temporarily unavailable', code: 'CIRCUIT_OPEN' }, 503);
    }
    if (!executionQueue.acquire()) {
      return c.json({ error: 'Execution queue full, try again shortly', code: 'QUEUE_FULL' }, 429);
    }

    try {
      // Append test code if present
      const codeToRun = exercise.test_code
        ? `${parsed.data.code}\n\n${exercise.test_code}`
        : parsed.data.code;

      const [timeoutSetting] =
        await sql`SELECT value FROM settings WHERE key = 'learn.executionTimeoutSeconds'`;
      const [memorySetting] =
        await sql`SELECT value FROM settings WHERE key = 'learn.executionMemoryMb'`;
      const timeoutSeconds = typeof timeoutSetting?.value === 'number' ? timeoutSetting.value : 30;
      const memoryMb = typeof memorySetting?.value === 'number' ? memorySetting.value : 128;

      const result = await runCode({
        code: codeToRun,
        timeoutSeconds,
        memoryMb,
      });

      stdout = result.stdout;
      stderr = result.stderr;
      passed = result.exitCode === 0;
      executionMs = result.durationMs;

      // Only trip circuit breaker on infrastructure failures, not user code errors
      if (result.infrastructureError) {
        circuitBreaker.recordFailure();
      } else {
        circuitBreaker.recordSuccess();
      }
    } catch (err) {
      circuitBreaker.recordFailure();
      log.error(
        { exerciseId, error: err instanceof Error ? err.message : String(err) },
        'code-execution:error',
      );
      stderr = err instanceof Error ? err.message : 'Execution failed';
      passed = false;
    } finally {
      executionQueue.release();
    }
  }

  // AI evaluation (non-fatal)
  let aiFeedback: string | null = null;
  let score: number | null = null;

  const credentials = c.get('aiCredentials');
  if (credentials?.apiKey) {
    try {
      const concepts = (exercise.concepts as string[]).join(', ');
      const aiResponse = await createCompletion({
        credentials,
        system: `You are an expert programming instructor evaluating a student submission for the "${exercise.track_title}" learning track, module "${exercise.module_title}" (concepts: ${concepts}). The exercise prompt was: "${exercise.prompt}". Evaluate the code. Return JSON only: { "correctness": 1-5, "codeQuality": 1-5, "completeness": 1-5, "feedback": "string", "hints": ["improvement hints"] }`,
        messages: [
          {
            role: 'user',
            content: `Student code:\n\`\`\`\n${parsed.data.code}\n\`\`\`\n${stdout ? `\nExecution output:\n${stdout}` : ''}${stderr ? `\nErrors:\n${stderr}` : ''}`,
          },
        ],
        maxTokens: 800,
      });

      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        const evalData = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
        aiFeedback = JSON.stringify(evalData);
        const avg =
          ((evalData.correctness ?? 0) +
            (evalData.codeQuality ?? 0) +
            (evalData.completeness ?? 0)) /
          3;
        score = Math.round(avg);
      } catch {
        log.warn(
          { exerciseId, response: aiResponse.slice(0, 200) },
          'learn:ai:parse-failed, using raw response',
        );
        aiFeedback = aiResponse;
      }

      log.info({ exerciseId, score }, 'learn:evaluation:complete');
    } catch (err) {
      log.error(
        { exerciseId, error: err instanceof Error ? err.message : String(err) },
        'learn:ai:error',
      );
      // Non-fatal: continue without AI feedback
    }
  }

  // Save submission
  const [submission] = await sql`
    INSERT INTO submissions (exercise_id, user_id, user_code, stdout, stderr, passed, ai_feedback, score, execution_ms)
    VALUES (${exerciseId}, ${userId}, ${parsed.data.code}, ${stdout}, ${stderr}, ${passed}, ${aiFeedback}, ${score}, ${executionMs})
    RETURNING *
  `;

  return c.json(
    {
      id: submission.id,
      exerciseId: submission.exercise_id,
      userId: submission.user_id,
      userCode: submission.user_code,
      stdout: submission.stdout,
      stderr: submission.stderr,
      passed: submission.passed,
      aiFeedback: submission.ai_feedback,
      score: submission.score,
      executionMs: submission.execution_ms,
      createdAt: String(submission.created_at),
    },
    201,
  );
});

export default learn;
