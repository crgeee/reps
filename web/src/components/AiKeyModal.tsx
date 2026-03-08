import { useState } from 'react';
import { setAiConfig, clearAiConfig, type AiProvider } from '../ai-config';
import { testAiKey } from '../api';

interface Props {
  onClose: () => void;
  onConfigured: () => void;
}

export default function AiKeyModal({ onClose, onConfigured }: Props) {
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!apiKey.trim()) return;
    setAiConfig({ provider, apiKey: apiKey.trim() });
    setStatus('testing');
    setError('');
    try {
      await testAiKey();
      onConfigured();
    } catch (err) {
      clearAiConfig();
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Connect AI Provider</h2>
          <p className="text-sm text-zinc-400 mt-1">
            AI features require your own API key. It's stored in your browser only.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['anthropic', 'openai'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                provider === p
                  ? 'border-zinc-500 bg-zinc-800'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <p className="text-sm font-medium text-zinc-200">
                {p === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </p>
              <p className="text-xs text-zinc-500">{p === 'anthropic' ? 'Claude' : 'GPT-4o'}</p>
            </button>
          ))}
        </div>

        <input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setStatus('idle');
          }}
          placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-sm"
        />

        {status === 'error' && (
          <p className="text-sm text-red-400">{error || 'Key validation failed'}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!apiKey.trim() || status === 'testing'}
            className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'testing' ? 'Verifying...' : 'Connect'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Your key is stored in your browser only, never on our servers.
        </p>
      </div>
    </div>
  );
}
