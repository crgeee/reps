import { useState } from 'react';
import type { Task, Quality, EvaluationResult } from '../types';
import { TOPIC_LABELS } from '../types';
import { getQuestion, evaluateAnswer, submitReview } from '../api';
import { logger } from '../logger';
import FocusTimer from './FocusTimer';
import ScoreCard from './ScoreCard';

interface ReviewSessionProps {
  dueTasks: Task[];
  onComplete: () => void;
}

type Step = 'question' | 'answer' | 'evaluation' | 'rating' | 'done';

const QUALITY_LABELS: Record<Quality, string> = {
  0: '0 - Total blackout',
  1: '1 - Wrong, but recalled something',
  2: '2 - Wrong, but easy to recall',
  3: '3 - Correct, serious difficulty',
  4: '4 - Correct, some hesitation',
  5: '5 - Perfect response',
};

export default function ReviewSession({ dueTasks, onComplete }: ReviewSessionProps) {
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
        <h1 className="text-3xl font-bold">Review Complete</h1>
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Task {currentIndex + 1} of {dueTasks.length}
        </span>
        <span>{TOPIC_LABELS[task.topic]}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-400 rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / dueTasks.length) * 100}%` }}
        />
      </div>

      {/* Task card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-1">{task.title}</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Reps: {task.repetitions} | EF: {task.easeFactor.toFixed(2)} | Interval: {task.interval}d
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded text-red-200 text-sm">
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
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('answer')}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Write Answer for Evaluation
                </button>
                <button
                  onClick={skipEvaluation}
                  className="px-6 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
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
              rows={8}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-y transition-all duration-200"
            />
            <div className="flex gap-3">
              <button
                onClick={handleEvaluate}
                disabled={loading || !answer.trim()}
                className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {loading ? 'Evaluating...' : 'Submit for Evaluation'}
              </button>
              <button
                onClick={skipEvaluation}
                className="px-6 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step: Evaluation results */}
        {step === 'evaluation' && evaluation && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
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
