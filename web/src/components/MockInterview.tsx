import { useState } from 'react';
import { Brain } from 'lucide-react';
import type { Topic, MockDifficulty, MockSession, MockScore } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { startMockInterview, respondToMock } from '../api';
import FocusTimer from './FocusTimer';
import ScoreCard from './ScoreCard';

type MockState = 'idle' | 'questioning' | 'answering' | 'evaluation' | 'done';

const DIFFICULTIES: { value: MockDifficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'Easy', desc: 'Foundational concepts' },
  { value: 'medium', label: 'Medium', desc: 'Applied problems' },
  { value: 'hard', label: 'Hard', desc: 'Advanced depth' },
];

export default function MockInterview() {
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
      // First message from interviewer is the question
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-purple-400" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mock Interview</h1>
          <p className="text-zinc-400 text-sm">Simulated interview with AI evaluation</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Idle: setup */}
      {state === 'idle' && (
        <div className="space-y-6">
          {/* Topic picker */}
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
                  <span className={`w-2 h-2 rounded-full ${TOPIC_COLORS[t]}`} />
                  {TOPIC_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty picker */}
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
                  <p className="text-[11px] text-zinc-600 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Interview'}
            </button>
            <button
              onClick={surpriseMe}
              className="px-5 py-3 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 hover:text-zinc-100 transition-all duration-200"
            >
              Surprise me
            </button>
          </div>
        </div>
      )}

      {/* Questioning: show question + timer */}
      {state === 'questioning' && (
        <div className="space-y-4">
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Interviewer</span>
              <span className="ml-auto text-xs text-zinc-600">
                {TOPIC_LABELS[topic]} · {difficulty}
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
          {/* Question smaller above */}
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

          <div className="flex gap-3">
            <button
              onClick={handleSubmitAnswer}
              disabled={loading || !answer.trim()}
              className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Evaluating...' : 'Submit Answer'}
            </button>
            <button
              onClick={() => setState('questioning')}
              className="px-5 py-3 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg hover:border-zinc-600 hover:text-zinc-200 transition-all duration-200"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Evaluation: scores */}
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
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Areas to Improve</p>
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
