import { useState } from 'react';
import { getAiConfig, setAiConfig, clearAiConfig, type AiProvider } from '../../ai-config';
import { testAiKey } from '../../api';
import { SectionHeader } from './shared';

const PROVIDER_OPTIONS: {
  value: AiProvider;
  label: string;
  models: { value: string; label: string; description: string }[];
}[] = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Best balance' },
      {
        value: 'claude-haiku-4-5-20251001',
        label: 'Claude Haiku 4.5',
        description: 'Fastest & cheapest',
      },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o', description: 'Best balance' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fastest & cheapest' },
    ],
  },
];

export default function AiSettings() {
  const existing = getAiConfig();
  const [provider, setProvider] = useState<AiProvider>(existing?.provider ?? 'anthropic');
  const providerConfig = PROVIDER_OPTIONS.find((p) => p.value === provider)!;
  const defaultModel = providerConfig.models[0]!.value;
  const [model, setModel] = useState(existing?.model ?? defaultModel);
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(!!existing);

  function handleProviderChange(newProvider: AiProvider) {
    setProvider(newProvider);
    const newConfig = PROVIDER_OPTIONS.find((p) => p.value === newProvider)!;
    setModel(newConfig.models[0]!.value);
    setSaved(false);
    setTestStatus('idle');
  }

  function handleClear() {
    clearAiConfig();
    setApiKey('');
    setSaved(false);
    setTestStatus('idle');
    setTestError('');
  }

  async function handleTest() {
    if (!apiKey.trim()) return;
    setAiConfig({ provider, apiKey: apiKey.trim(), model });
    setSaved(true);
    setTestStatus('testing');
    setTestError('');
    try {
      await testAiKey();
      setTestStatus('success');
    } catch (err) {
      clearAiConfig();
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Test failed');
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon="sparkles" title="AI Provider" />
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-5">
        <p className="text-sm text-zinc-400">
          Connect your own AI provider to enable question generation, answer evaluation, and mock
          interviews. Your API key is stored in your browser only and never saved on our servers.
        </p>

        {/* Provider selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400">Provider</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleProviderChange(opt.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  provider === opt.value
                    ? 'border-zinc-500 bg-zinc-800'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                <p className="text-sm font-medium text-zinc-200">{opt.label}</p>
                <p className="text-xs text-zinc-500">{opt.models[0]!.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Model selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400">Model</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {providerConfig.models.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  setModel(m.value);
                  setSaved(false);
                  setTestStatus('idle');
                }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  model === m.value
                    ? 'border-zinc-500 bg-zinc-800'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                <p className="text-sm font-medium text-zinc-200">{m.label}</p>
                <p className="text-xs text-zinc-500">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* API Key input */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-400">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaved(false);
              setTestStatus('idle');
            }}
            placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono text-sm"
          />
        </label>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || testStatus === 'testing'}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'testing' ? 'Testing...' : 'Save & Test Key'}
          </button>
          {saved && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-red-400 transition-colors"
            >
              Remove Key
            </button>
          )}
        </div>

        {/* Status */}
        {testStatus === 'success' && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Key verified — AI features are active
          </div>
        )}
        {testStatus === 'error' && (
          <div className="text-sm text-red-400">
            <p>Key validation failed</p>
            {testError && <p className="text-xs text-red-400/70 mt-1">{testError}</p>}
          </div>
        )}

        {/* Privacy notice */}
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">
            Your API key is stored in your browser's local storage and sent directly with each AI
            request. It is never saved to our database or accessible to server administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
