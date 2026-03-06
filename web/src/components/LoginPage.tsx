import React, { useState } from 'react';
import { Navigate } from 'react-router';
import { Brain, Sparkles, Target, Plug } from 'lucide-react';
import { sendMagicLink } from '../api';
import { useAuth } from '../hooks/useAuth';
import Footer from './Footer';

/** Logo: three ascending bars — stacking reps, rising mastery */
function RepsLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#18181b" />
      <rect x="8" y="24" width="6" height="8" rx="1.5" fill="#f59e0b" opacity="0.4" />
      <rect x="17" y="18" width="6" height="14" rx="1.5" fill="#f59e0b" opacity="0.7" />
      <rect x="26" y="10" width="6" height="22" rx="1.5" fill="#f59e0b" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Target,
    title: 'Smart Prioritization',
    description:
      'A weighted algorithm scores every task on urgency, difficulty, staleness, and AI feedback. You always know what to work on next.',
  },
  {
    icon: Brain,
    title: 'Spaced Repetition',
    description:
      "SM-2 schedules reviews at the moment you're about to forget. Intervals grow from 1 day to months as you master topics.",
  },
  {
    icon: Sparkles,
    title: 'AI Interview Coach',
    description:
      'Claude generates Anthropic-style questions, evaluates your answers on clarity, specificity, and mission alignment.',
  },
  {
    icon: Plug,
    title: 'Integrate',
    description:
      'Connect Claude Desktop, Claude Code, or any MCP client directly to your prep data.',
  },
];

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
        }}
      />

      {/* Hero + Login */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center relative z-10">
        <div className="anim-fade-in">
          <RepsLogo className="w-14 h-14 mx-auto" />
        </div>

        <h1
          className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight anim-slide-up"
          style={{ animationDelay: '50ms' }}
        >
          <span className="wordmark">reps</span>
        </h1>

        <p
          className="mt-3 text-base sm:text-lg text-zinc-400 max-w-md anim-slide-up"
          style={{ animationDelay: '100ms' }}
        >
          Track tasks. Build recall. Practice with AI.
          <br />
          <span className="text-zinc-500">Your interview prep, systematized.</span>
        </p>

        {/* Login Form */}
        <div className="mt-8 w-full max-w-sm anim-slide-up" style={{ animationDelay: '150ms' }}>
          {sent ? (
            <div className="anim-scale-in">
              <div className="p-5 bg-zinc-900/80 border border-zinc-800 rounded-xl backdrop-blur-sm">
                <p className="text-zinc-200 font-medium mb-1">Check your email</p>
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
                  className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-red-200 text-sm anim-scale-in"
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
                className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all backdrop-blur-sm"
              />
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="glow-amber w-full py-3 bg-amber-500 text-zinc-950 font-semibold rounded-xl hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {sending ? 'Sending...' : 'Get started'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20 relative z-10">
        <div className="max-w-2xl mx-auto grid gap-3 sm:grid-cols-2 lg:grid-cols-4 anim-stagger">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="anim-slide-up group p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <f.icon className="w-5 h-5 text-amber-500/80 mb-2.5 group-hover:text-amber-400 transition-colors" />
              <h3 className="text-sm font-semibold text-zinc-200">{f.title}</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works teaser */}
      <section className="px-6 pb-12 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 text-sm text-zinc-400">
            <span className="text-amber-500 font-medium">Schedule</span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="text-amber-500 font-medium">Review</span>
            <span className="text-zinc-600">&rarr;</span>
            <span className="text-amber-500 font-medium">Improve</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href="/how-it-works"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              How it works &rarr;
            </a>
            <a href="/blog" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Blog &rarr;
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
