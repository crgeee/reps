import React, { useState } from 'react';
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
      <div className="flex-1 flex items-center justify-center">
        <form className="w-full max-w-sm p-8" onSubmit={handleSubmit}>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <RepsIcon />
            reps
          </h1>
          <p className="text-zinc-400 mb-8">Sign in with your email to get started.</p>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm"
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
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 mb-4"
          />
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}
