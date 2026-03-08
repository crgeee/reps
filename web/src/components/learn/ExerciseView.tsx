import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Play,
  Send,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Terminal,
  Clock,
  Sparkles,
} from 'lucide-react';
import { getTrack, generateExercise, runCode, submitCode } from '../../learn-api.js';
import type {
  Exercise,
  ExecutionResult,
  Submission,
  AiFeedback,
  TrackDetail,
} from '../../learn-types.js';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function EditorFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-zinc-900 rounded-lg">
      <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color =
    value >= 4
      ? 'text-green-400 border-green-800 bg-green-950/40'
      : value >= 3
        ? 'text-yellow-400 border-yellow-800 bg-yellow-950/40'
        : 'text-red-400 border-red-800 bg-red-950/40';
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${color}`}>
      <div className="text-lg font-bold font-mono">{value}/5</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

export default function ExerciseView() {
  const { slug, moduleSlug } = useParams<{ slug: string; moduleSlug: string }>();
  const navigate = useNavigate();

  // Data state
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [runCooldown, setRunCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moduleId = track?.modules.find((m) => m.slug === moduleSlug)?.id;

  const fetchExercise = useCallback(async (modId: string) => {
    setLoading(true);
    setError(null);
    setOutput(null);
    setSubmission(null);
    setAiFeedback(null);
    setHintsOpen(false);
    try {
      const ex = await generateExercise(modId);
      setExercise(ex);
      setCode(ex.starterCode ?? '');
    } catch (e) {
      const msg = String(e);
      if (msg.includes('AI_NOT_CONFIGURED')) {
        setError('AI is not configured. Add your API key in Settings to generate exercises.');
      } else if (msg.includes('429')) {
        setError('Exercise generation queue is full. Try again in a moment.');
      } else if (msg.includes('503')) {
        setError('Exercise generation is temporarily unavailable.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    getTrack(slug)
      .then((t) => {
        setTrack(t);
      })
      .catch((e) => setError(String(e)));
  }, [slug]);

  useEffect(() => {
    if (moduleId) {
      void fetchExercise(moduleId);
    }
  }, [moduleId, fetchExercise]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  async function handleRun() {
    if (!exercise || running || runCooldown) return;
    setRunning(true);
    setOutput(null);
    setError(null);
    try {
      const result = await runCode(exercise.id, code);
      setOutput(result);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('429')) {
        setError('Execution queue is full. Try again shortly.');
      } else if (msg.includes('503')) {
        setError('Code execution is temporarily unavailable.');
      } else {
        setError(msg);
      }
    } finally {
      setRunning(false);
      setRunCooldown(true);
      cooldownTimer.current = setTimeout(() => setRunCooldown(false), 2000);
    }
  }

  async function handleSubmit() {
    if (!exercise || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const sub = await submitCode(exercise.id, code);
      setSubmission(sub);
      if (sub.aiFeedback) {
        try {
          setAiFeedback(JSON.parse(sub.aiFeedback) as AiFeedback);
        } catch {
          // AI feedback wasn't valid JSON — still show execution results
        }
      }
      setOutput({
        stdout: sub.stdout ?? '',
        stderr: sub.stderr ?? '',
        exitCode: sub.passed ? 0 : 1,
        durationMs: sub.executionMs ?? 0,
        timedOut: false,
      });
    } catch (e) {
      const msg = String(e);
      if (msg.includes('429')) {
        setError('Submission queue is full. Try again shortly.');
      } else if (msg.includes('503')) {
        setError('Code submission is temporarily unavailable.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewExercise() {
    if (moduleId) {
      void fetchExercise(moduleId);
    }
  }

  if (loading && !exercise) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mx-auto" />
          <p className="text-xs text-zinc-500">Generating exercise...</p>
        </div>
      </div>
    );
  }

  if (error && !exercise) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-zinc-400 hover:text-zinc-200 underline transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const difficultyLabel = exercise
    ? exercise.difficulty <= 2
      ? 'Easy'
      : exercise.difficulty <= 4
        ? 'Medium'
        : 'Hard'
    : '';
  const difficultyColor = exercise
    ? exercise.difficulty <= 2
      ? 'text-green-400'
      : exercise.difficulty <= 4
        ? 'text-yellow-400'
        : 'text-red-400'
    : '';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {exercise && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                {exercise.type}
              </span>
              <span className="text-zinc-700">|</span>
              <span className={`text-xs font-medium ${difficultyColor}`}>{difficultyLabel}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleNewExercise}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          New Exercise
        </button>
      </div>

      {/* Problem statement */}
      {exercise && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0 max-h-48 overflow-y-auto">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {exercise.prompt}
          </p>
          {exercise.hints && exercise.hints.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setHintsOpen(!hintsOpen)}
                className="flex items-center gap-1 text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
              >
                <Lightbulb className="w-3 h-3" />
                {hintsOpen ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {exercise.hints.length} {exercise.hints.length === 1 ? 'hint' : 'hints'}
              </button>
              {hintsOpen && (
                <ul className="mt-2 space-y-1">
                  {exercise.hints.map((hint, i) => (
                    <li key={i} className="text-xs text-zinc-400 pl-4 border-l border-amber-800/40">
                      {hint}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main split pane */}
      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor toolbar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 flex-shrink-0">
            <button
              onClick={handleRun}
              disabled={running || runCooldown || !exercise}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !exercise}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-300 bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-800/60 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              Submit
            </button>
            {error && <span className="text-xs text-red-400 ml-auto truncate">{error}</span>}
          </div>
          {/* Monaco */}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<EditorFallback />}>
              <MonacoEditor
                language="python"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 8 },
                }}
              />
            </Suspense>
          </div>
        </div>

        {/* Output / Feedback panel */}
        <div className="w-96 border-l border-zinc-800 flex flex-col bg-zinc-950/50 overflow-y-auto flex-shrink-0">
          {!output && !submission && (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div className="space-y-2">
                <Terminal className="w-6 h-6 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-600">Run or submit your code to see output</p>
              </div>
            </div>
          )}

          {output && (
            <div className="p-3 space-y-3">
              {/* Execution result */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {output.exitCode === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={`text-xs font-medium ${output.exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {output.exitCode === 0 ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-mono">{output.durationMs}ms</span>
                  </div>
                </div>

                {output.stdout && (
                  <div className="rounded-md bg-green-950/20 border border-green-900/30 p-2">
                    <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {output.stdout}
                    </pre>
                  </div>
                )}
                {output.stderr && (
                  <div className="rounded-md bg-red-950/20 border border-red-900/30 p-2">
                    <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {output.stderr}
                    </pre>
                  </div>
                )}
              </div>

              {/* AI Feedback */}
              {aiFeedback && (
                <div className="space-y-3 border-t border-zinc-800 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-zinc-300">AI Feedback</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <ScoreBadge label="Correct" value={aiFeedback.correctness} />
                    <ScoreBadge label="Quality" value={aiFeedback.codeQuality} />
                    <ScoreBadge label="Complete" value={aiFeedback.completeness} />
                  </div>

                  {aiFeedback.feedback && (
                    <p className="text-xs text-zinc-400 leading-relaxed">{aiFeedback.feedback}</p>
                  )}

                  {aiFeedback.hints && aiFeedback.hints.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Suggestions
                      </span>
                      <ul className="space-y-1">
                        {aiFeedback.hints.map((hint, i) => (
                          <li
                            key={i}
                            className="text-xs text-zinc-400 pl-3 border-l border-blue-800/40"
                          >
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
