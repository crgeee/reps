import React, { useState } from 'react';
import { Brain, Sparkles, BarChart3, ChevronDown } from 'lucide-react';
import { sendMagicLink } from '../api';
import Footer from './Footer';

const RepsIcon = () => (
  <svg
    className="w-10 h-10 inline-block mr-2 align-middle"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="32" height="32" rx="6" fill="#09090b" />
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

const RepsIconLarge = () => (
  <svg className="w-16 h-16" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
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
    icon: Brain,
    title: 'Spaced Repetition',
    description:
      'SM-2 algorithm schedules reviews at optimal intervals so you retain more with less effort.',
  },
  {
    icon: Sparkles,
    title: 'AI Coaching',
    description:
      'Claude-powered interview questions and real-time evaluation of your answers with structured feedback.',
  },
  {
    icon: BarChart3,
    title: 'Track Everything',
    description: 'Progress by topic, review heatmaps, and streak tracking to keep you accountable.',
  },
];

const STEPS = [
  {
    num: '1',
    title: 'Add tasks',
    description: 'Organize by topic: coding, system design, behavioral, papers.',
  },
  {
    num: '2',
    title: 'Review with AI',
    description: 'Get interview-style questions and instant feedback on your answers.',
  },
  {
    num: '3',
    title: 'Track mastery',
    description: 'Spaced repetition ensures you review at the right time.',
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

  if (sent) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm p-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              <RepsIcon />
              reps
            </h1>
            <div className="mt-8 p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
              <p className="text-zinc-300 mb-2">Check your email</p>
              <p className="text-zinc-500 text-sm">
                We sent a sign-in link to <span className="text-zinc-300">{email}</span>. Click the
                link to sign in.
              </p>
            </div>
            <button
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
              className="mt-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Use a different email
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
        <RepsIconLarge />
        <h1 className="mt-6 text-5xl sm:text-6xl font-extrabold tracking-tight">
          Get your reps in.
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-zinc-400 max-w-lg">
          Spaced repetition meets AI coaching. Prepare for technical interviews with a system that
          adapts to you.
        </p>
        <a
          href="#login"
          className="mt-8 inline-flex items-center px-6 py-3 bg-amber-500 text-zinc-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          Get started
        </a>
        <ChevronDown className="absolute bottom-8 w-6 h-6 text-zinc-600 animate-bounce" />
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3"
            >
              <f.icon className="w-8 h-8 text-amber-500" />
              <h3 className="text-lg font-semibold text-zinc-100">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots */}
      <section className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">See it in action</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {['Dashboard', 'Review Session'].map((label) => (
              <div
                key={label}
                className="aspect-video bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center"
              >
                <span className="text-zinc-600 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">How it works</h2>
          <div className="space-y-8">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-5 items-start">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-500 font-bold text-sm">{step.num}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">{step.title}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Login Form */}
      <section id="login" className="py-24 px-6 bg-zinc-900/30">
        <div className="max-w-sm mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-8">Start preparing</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              {sending ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
