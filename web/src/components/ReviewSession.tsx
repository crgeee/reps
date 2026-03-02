import { useState } from 'react';
import { Brain } from 'lucide-react';
import type {
  Task,
  Quality,
  EvaluationResult,
  Topic,
  MockDifficulty,
  MockSession,
  MockScore,
} from '../types';
import { TOPICS, getTopicLabel, getTopicColor } from '../types';
import {
  getQuestion,
  evaluateAnswer,
  submitReview,
  startMockInterview,
  respondToMock,
} from '../api';
import { logger } from '../logger';
import FocusTimer from './FocusTimer';
import ScoreCard from './ScoreCard';

interface ReviewSessionProps {
  dueTasks: Task[];
  onComplete: () => void;
}

type ReviewMode = 'review' | 'practice';

export default function ReviewSession({ dueTasks, onComplete }: ReviewSessionProps) {
  const [mode, setMode] = useState<ReviewMode>('review');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-full sm:w-fit">
        <button
          onClick={() => setMode('review')}
          className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'review'
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          Review
          {dueTasks.length > 0 && (
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                mode === 'review' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {dueTasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMode('practice')}
          className={`flex-1 sm:flex-initial px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            mode === 'practice'
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          Practice
        </button>
      </div>

      {mode === 'review' ? (
        <SpacedReview dueTasks={dueTasks} onComplete={onComplete} />
      ) : (
        <PracticeMode />
      )}
    </div>
  );
}

/* ── Spaced Review (original ReviewSession logic) ── */

type Step = 'question' | 'answer' | 'evaluation' | 'rating' | 'done';

const QUALITY_LABELS: Record<Quality, string> = {
  0: '0 - Total blackout',
  1: '1 - Wrong, but recalled something',
  2: '2 - Wrong, but easy to recall',
  3: '3 - Correct, serious difficulty',
  4: '4 - Correct, some hesitation',
  5: '5 - Perfect response',
};

function SpacedReview({ dueTasks, onComplete }: { dueTasks: Task[]; onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<Step>('question');
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionLoaded, setQuestionLoaded] = useState(false);

  const task = dueTasks[currentIndex];

  if (!task || step === 'done') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
        <h1 className="text-lg font-bold">Review Complete</h1>
        <p className="text-zinc-400">
          {dueTasks.length === 0
            ? 'No tasks due for review right now.'
            : `You reviewed ${dueTasks.length} ${dueTasks.length === 1 ? 'task' : 'tasks'}.`}
        </p>
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  async function loadQuestion() {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const { question: q } = await getQuestion(task.id);
      setQuestion(q);
      setQuestionLoaded(true);
    } catch (err) {
      logger.error('Failed to load question', { taskId: task.id, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to load question');
    } finally {
      setLoading(false);
    }
  }

  async function handleEvaluate() {
    if (!task || !answer.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await evaluateAnswer(task.id, answer);
      setEvaluation(result);
      setStep('evaluation');
    } catch (err) {
      logger.error('Failed to evaluate answer', { taskId: task.id, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to evaluate');
    } finally {
      setLoading(false);
    }
  }

  async function handleRate(quality: Quality) {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      await submitReview(task.id, quality);
      // Move to next task
      const nextIndex = currentIndex + 1;
      if (nextIndex >= dueTasks.length) {
        setStep('done');
      } else {
        setCurrentIndex(nextIndex);
        setStep('question');
        setQuestion(null);
        setAnswer('');
        setEvaluation(null);
        setQuestionLoaded(false);
      }
    } catch (err) {
      logger.error('Failed to submit review', { taskId: task.id, quality, error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  }

  function skipEvaluation() {
    setStep('rating');
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span className="font-mono tabular-nums">
          {currentIndex + 1} / {dueTasks.length}
        </span>
        <span className="text-xs uppercase tracking-widest">{getTopicLabel(task.topic)}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={dueTasks.length}
          aria-label={`Review progress: ${currentIndex + 1} of ${dueTasks.length}`}
          className="h-full bg-amber-500 rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / dueTasks.length) * 100}%` }}
        />
      </div>

      {/* Task card */}
      <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-1">{task.title}</h2>
        <p className="text-sm text-zinc-400 mb-6 font-mono">
          Reps: {task.repetitions} | EF: {task.easeFactor.toFixed(2)} | Interval: {task.interval}d
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-950 border border-red-800 rounded text-red-200 text-sm"
          >
            {error}
          </div>
        )}

        {/* Step: Question */}
        {step === 'question' && (
          <div className="space-y-4">
            {!questionLoaded ? (
              <button
                onClick={loadQuestion}
                disabled={loading}
                className="w-full py-3 bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating question...' : 'Generate AI Question'}
              </button>
            ) : (
              <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Interview Question
                </p>
                <p className="text-zinc-100 whitespace-pre-wrap">{question}</p>
              </div>
            )}

            {questionLoaded && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setStep('answer')}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Write Answer for Evaluation
                </button>
                <button
                  onClick={skipEvaluation}
                  className="sm:w-auto py-3 px-6 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                >
                  Skip to Rating
                </button>
              </div>
            )}

            {!questionLoaded && (
              <button
                onClick={skipEvaluation}
                className="w-full py-3 bg-zinc-800/50 text-zinc-500 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              >
                Skip AI question, go to rating
              </button>
            )}
          </div>
        )}

        {/* Step: Answer */}
        {step === 'answer' && (
          <div className="space-y-4">
            {question && (
              <div className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Question</p>
                <p className="text-zinc-200 text-sm whitespace-pre-wrap">{question}</p>
              </div>
            )}
            <FocusTimer />
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              aria-label="Your answer"
              rows={8}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-y transition-all duration-200"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleEvaluate}
                disabled={loading || !answer.trim()}
                className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {loading ? 'Evaluating...' : 'Submit for Evaluation'}
              </button>
              <button
                onClick={skipEvaluation}
                className="sm:w-auto py-3 px-6 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step: Evaluation results */}
        {step === 'evaluation' && evaluation && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <ScoreCard label="Clarity" score={evaluation.clarity} />
              <ScoreCard label="Specificity" score={evaluation.specificity} />
              <ScoreCard label="Mission Align" score={evaluation.missionAlignment} />
            </div>

            <div className="p-4 bg-zinc-800 rounded-lg space-y-3">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Feedback</p>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{evaluation.feedback}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Suggested Improvement
                </p>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {evaluation.suggestedImprovement}
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep('rating')}
              className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Continue to SM-2 Rating
            </button>
          </div>
        )}

        {/* Step: SM-2 Rating */}
        {step === 'rating' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              How well did you recall/perform on this task? Rate your response quality:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {([0, 1, 2, 3, 4, 5] as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => handleRate(q)}
                  disabled={loading}
                  className={`text-left px-4 py-3 rounded-lg border transition-all duration-150 disabled:opacity-50 focus:outline-none focus:ring-1 ${
                    q >= 4
                      ? 'border-green-800/50 bg-green-950/30 hover:bg-green-950/50 text-green-300 focus:ring-green-700'
                      : q >= 3
                        ? 'border-amber-800/50 bg-amber-950/30 hover:bg-amber-950/50 text-amber-300 focus:ring-amber-700'
                        : 'border-red-800/50 bg-red-950/30 hover:bg-red-950/50 text-red-300 focus:ring-red-700'
                  }`}
                >
                  {QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Practice Mode (from MockInterview) ── */

const DIFFICULTIES: { value: MockDifficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'Easy', desc: 'Foundational concepts' },
  { value: 'medium', label: 'Medium', desc: 'Applied problems' },
  { value: 'hard', label: 'Hard', desc: 'Advanced depth' },
];

type MockState = 'idle' | 'questioning' | 'answering' | 'evaluation' | 'done';

function PracticeMode() {
  const [state, setState] = useState<MockState>('idle');
  const [topic, setTopic] = useState<Topic>('coding');
  const [difficulty, setDifficulty] = useState<MockDifficulty>('medium');
  const [session, setSession] = useState<MockSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState<MockScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function surpriseMe() {
    const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)]!;
    const diffs: MockDifficulty[] = ['easy', 'medium', 'hard'];
    const randomDiff = diffs[Math.floor(Math.random() * diffs.length)]!;
    setTopic(randomTopic);
    setDifficulty(randomDiff);
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const sess = await startMockInterview(topic, difficulty);
      setSession(sess);
      const firstMsg = sess.messages.find((m) => m.role === 'interviewer');
      setCurrentQuestion(firstMsg?.content ?? '');
      setState('questioning');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!session || !answer.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await respondToMock(session.id, answer);
      if (result.done && result.score) {
        setScore(result.score);
        setState('evaluation');
      } else if (result.followUp) {
        setCurrentQuestion(result.followUp);
        setAnswer('');
        setState('questioning');
      } else {
        setState('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setState('idle');
    setSession(null);
    setCurrentQuestion('');
    setAnswer('');
    setScore(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Idle: setup */}
      {state === 'idle' && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-400 mb-3">Topic</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                    topic === t
                      ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${getTopicColor(t)}`} />
                  {getTopicLabel(t)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-400 mb-3">Difficulty</p>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`px-4 py-3 rounded-lg border text-left transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                    difficulty === d.value
                      ? 'border-zinc-500 bg-zinc-800'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-200">{d.label}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Interview'}
            </button>
            <button
              onClick={surpriseMe}
              className="sm:w-auto px-5 py-3 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 hover:text-zinc-100 transition-all duration-200"
            >
              Surprise me
            </button>
          </div>
        </div>
      )}

      {/* Questioning */}
      {state === 'questioning' && (
        <div className="space-y-4">
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Interviewer</span>
              <span className="ml-auto text-xs text-zinc-400">
                {getTopicLabel(topic)} · {difficulty}
              </span>
            </div>
            <p className="text-zinc-100 text-base leading-relaxed whitespace-pre-wrap">
              {currentQuestion}
            </p>
          </div>

          <FocusTimer />

          <button
            onClick={() => setState('answering')}
            className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Write My Answer
          </button>
        </div>
      )}

      {/* Answering */}
      {state === 'answering' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Question</p>
            <p className="text-zinc-300 text-sm leading-relaxed">{currentQuestion}</p>
          </div>

          <FocusTimer />

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write your answer here..."
            rows={8}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-y transition-all duration-200"
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmitAnswer}
              disabled={loading || !answer.trim()}
              className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Evaluating...' : 'Submit Answer'}
            </button>
            <button
              onClick={() => setState('questioning')}
              className="sm:w-auto px-5 py-3 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 hover:text-zinc-100 transition-all duration-200"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Evaluation */}
      {state === 'evaluation' && score && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Interview Results</h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <ScoreCard label="Clarity" score={score.clarity} />
            <ScoreCard label="Depth" score={score.depth} />
            <ScoreCard label="Correctness" score={score.correctness} />
            <ScoreCard label="Communication" score={score.communication} />
            <ScoreCard label="Overall" score={score.overall} />
          </div>

          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Feedback</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{score.feedback}</p>
            </div>

            {score.strengths.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {score.strengths.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-green-950/40 border border-green-800/40 rounded-full text-xs text-green-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {score.improvements.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Areas to Improve
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {score.improvements.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-amber-950/40 border border-amber-800/40 rounded-full text-xs text-amber-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            New Interview
          </button>
        </div>
      )}

      {/* Done (no score returned) */}
      {state === 'done' && (
        <div className="text-center py-12 space-y-4">
          <Brain className="w-12 h-12 text-purple-400 mx-auto" />
          <h2 className="text-xl font-semibold">Interview Complete</h2>
          <p className="text-zinc-400">Your session has ended.</p>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            New Interview
          </button>
        </div>
      )}
    </div>
  );
}
