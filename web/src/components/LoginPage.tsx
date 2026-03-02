import React, { useState } from 'react';
import { Brain, Sparkles, ListTodo } from 'lucide-react';
import { sendMagicLink } from '../api';
import Footer from './Footer';

const RepsIconLarge = () => (
  <svg className="w-12 h-12" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#09090b" stroke="#27272a" strokeWidth="0.5" />
    <text
      x="16"
      y="23"
      fontFamily="system-ui"
      fontWeight="800"
      fontSize="22"
      fill="#f59e0b"
      textAnchor="middle"
    >
      r
    </text>
    <path
      d="M24 8 C26 10, 26 13, 24 15"
      stroke="#f59e0b"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path
      d="M26 7 C29 10, 29 14, 26 17"
      stroke="#f59e0b"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      opacity="0.3"
    />
  </svg>
);

const FEATURES = [
  {
    icon: ListTodo,
    title: 'Organize Tasks',
    description: 'Collections, boards, priorities, tags, and custom statuses.',
  },
  {
    icon: Brain,
    title: 'Spaced Repetition',
    description: 'SM-2 algorithm schedules reviews at optimal intervals.',
  },
  {
    icon: Sparkles,
    title: 'AI Coaching',
    description: 'Claude-powered questions and real-time feedback.',
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;

    setSending(true);
    setError(null);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Hero + Login */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <RepsIconLarge />
        <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight">
          Get your reps in.
        </h1>
        <p className="mt-3 text-base text-zinc-400 max-w-md">
          Track your interview prep with task management, spaced repetition, and AI coaching — all
          in one place.
        </p>

        {/* Login Form */}
        <div className="mt-8 w-full max-w-sm">
          {sent ? (
            <div>
              <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
                <p className="text-zinc-300 mb-1">Check your email</p>
                <p className="text-zinc-500 text-sm">
                  We sent a sign-in link to <span className="text-zinc-300">{email}</span>.
                </p>
              </div>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="mt-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div
                  role="alert"
                  className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm"
                >
                  {error}
                </div>
              )}
              <label htmlFor="login-email" className="sr-only">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full py-3 bg-amber-500 text-zinc-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Get started'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <f.icon className="w-5 h-5 text-amber-500 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-200">{f.title}</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
