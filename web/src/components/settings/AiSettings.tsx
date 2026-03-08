import { useState, useEffect } from 'react';
import {
  getAiConfig,
  setAiConfig,
  clearAiConfig,
  getProviderConfig,
  getDefaultModel,
  type AiProvider,
  type AiStorageMode,
  type SavedAiKeyInfo,
} from '../../ai-config';
import {
  testAiKey,
  getServerAiKey,
  saveServerAiKey,
  deleteServerAiKey,
  getAiKeyStorageStatus,
} from '../../api';
import { SectionHeader } from './shared';
import ProviderPicker from '../ProviderPicker';

const EXPIRY_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
] as const;

const DISCLOSURE = {
  browser:
    'Your API key is stored only in your browser and sent directly with each request over HTTPS. It is never saved to our servers.',
  server:
    'Your API key is encrypted (AES-256) and stored on our server. It auto-expires after the period you select. The server decrypts your key only when making AI calls on your behalf — the same access level it has when you send the key via your browser. Administrators cannot read your key from the database without the separate encryption key.',
} as const;

function KeyInfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{children}</span>
    </div>
  );
}

export default function AiSettings() {
  const existing = getAiConfig();
  const [storageMode, setStorageMode] = useState<AiStorageMode>(existing?.storageMode ?? 'browser');
  const [provider, setProvider] = useState<AiProvider>(existing?.provider ?? 'anthropic');
  const [model, setModel] = useState(
    existing?.model ?? getDefaultModel(existing?.provider ?? 'anthropic'),
  );
  const [apiKey, setApiKey] = useState(
    existing?.storageMode === 'server' ? '' : (existing?.apiKey ?? ''),
  );
  const [showKey, setShowKey] = useState(false);
  const [expiryDays, setExpiryDays] = useState<30 | 90 | 365>(30);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saved, setSaved] = useState(!!existing);
  const [serverKeyInfo, setServerKeyInfo] = useState<SavedAiKeyInfo | null>(null);
  const [encryptionAvailable, setEncryptionAvailable] = useState<boolean | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  const initialStorageMode = existing?.storageMode;

  useEffect(() => {
    getAiKeyStorageStatus()
      .then((s) => setEncryptionAvailable(s.encryptionAvailable))
      .catch((err) => {
        console.error('Failed to check AI key storage status:', err);
        setEncryptionAvailable(false);
      });

    if (initialStorageMode === 'server') {
      getServerAiKey()
        .then(setServerKeyInfo)
        .catch((err) => {
          console.error('Failed to fetch server AI key:', err);
          setServerKeyInfo(null);
        });
    }
  }, [initialStorageMode]);

  const hasSavedKey = storageMode === 'browser' ? saved : !!serverKeyInfo;
  const modelLabel =
    getProviderConfig(provider).models.find((m) => m.value === model)?.label ?? model;

  function handleProviderChange(newProvider: AiProvider) {
    setProvider(newProvider);
    setModel(getDefaultModel(newProvider));
    setSaved(false);
    setTestStatus('idle');
  }

  function handleModeChange(mode: AiStorageMode) {
    if (mode === 'server' && !encryptionAvailable) return;
    setStorageMode(mode);
    setTestStatus('idle');
    setTestError('');
  }

  function handleClear() {
    clearAiConfig();
    setApiKey('');
    setSaved(false);
    setShowKey(false);
    setTestStatus('idle');
    setTestError('');
    if (storageMode === 'server') {
      deleteServerAiKey()
        .then(() => setServerKeyInfo(null))
        .catch(() => {
          setTestStatus('error');
          setTestError(
            'Key removed from browser, but failed to delete from server. Please try again.',
          );
        });
    }
  }

  async function handleSaveBrowser() {
    if (!apiKey.trim()) return;
    setAiConfig({ provider, apiKey: apiKey.trim(), model, storageMode: 'browser' });
    setSaved(true);
    setShowKey(false);
    setTestStatus('testing');
    setTestError('');
    try {
      await testAiKey();
      setTestStatus('success');
    } catch (err) {
      clearAiConfig();
      setSaved(false);
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Test failed');
    }
  }

  async function handleSaveServer() {
    if (!apiKey.trim()) return;
    setServerLoading(true);
    setTestStatus('testing');
    setTestError('');
    try {
      setAiConfig({ provider, apiKey: apiKey.trim(), model, storageMode: 'browser' });
      await testAiKey();
      const info = await saveServerAiKey({
        provider,
        apiKey: apiKey.trim(),
        model,
        expiryDays,
      });
      setServerKeyInfo(info);
      setAiConfig({ provider, apiKey: '', model, storageMode: 'server' });
      setSaved(true);
      setApiKey('');
      setShowKey(false);
      setTestStatus('success');
    } catch (err) {
      clearAiConfig();
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setServerLoading(false);
    }
  }

  async function handleRemoveServerKey() {
    setServerLoading(true);
    try {
      await deleteServerAiKey();
      setServerKeyInfo(null);
      clearAiConfig();
      setSaved(false);
      setTestStatus('idle');
    } catch (err) {
      setTestStatus('error');
      setTestError(
        err instanceof Error ? err.message : 'Failed to remove key from server. Please try again.',
      );
    } finally {
      setServerLoading(false);
    }
  }

  const daysRemaining = serverKeyInfo
    ? Math.max(0, Math.ceil((new Date(serverKeyInfo.expiresAt).getTime() - Date.now()) / 86400000))
    : null;
  const expiryWarning = daysRemaining !== null && daysRemaining <= 7;

  return (
    <div className="space-y-5">
      <SectionHeader icon="sparkles" title="AI Provider" />
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-5">
        <p className="text-sm text-zinc-400">
          Connect your own AI provider to enable question generation, answer evaluation, and mock
          interviews.
        </p>

        {/* Saved key info — shown when a key is configured */}
        {hasSavedKey && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-zinc-200">AI Key Configured</span>
              </div>
              <button
                onClick={storageMode === 'server' ? handleRemoveServerKey : handleClear}
                disabled={serverLoading}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
            <div className="px-4 py-1">
              <KeyInfoRow label="Provider">
                {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
              </KeyInfoRow>
              <KeyInfoRow label="Model">{modelLabel}</KeyInfoRow>
              <KeyInfoRow label="Storage">
                {storageMode === 'browser' ? 'Browser only' : 'Encrypted on server'}
              </KeyInfoRow>
              {storageMode === 'browser' && existing?.apiKey && (
                <KeyInfoRow label="Key">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="font-mono text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {showKey ? existing.apiKey : `${existing.apiKey.slice(0, 8)}...`}
                    <span className="ml-2 text-zinc-600">{showKey ? 'hide' : 'show'}</span>
                  </button>
                </KeyInfoRow>
              )}
              {storageMode === 'server' && serverKeyInfo && (
                <>
                  <KeyInfoRow label="Key">
                    <span className="font-mono text-xs">{serverKeyInfo.keyPrefix}</span>
                  </KeyInfoRow>
                  <KeyInfoRow label="Expires">
                    <span className={expiryWarning ? 'text-amber-400' : ''}>
                      {new Date(serverKeyInfo.expiresAt).toLocaleDateString()}
                      {expiryWarning && ` (${daysRemaining}d left)`}
                    </span>
                  </KeyInfoRow>
                </>
              )}
            </div>
          </div>
        )}

        {/* Setup form — shown when no key is saved */}
        {!hasSavedKey && (
          <>
            {/* Storage mode toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Key Storage</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => handleModeChange('browser')}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    storageMode === 'browser'
                      ? 'border-zinc-500 bg-zinc-800'
                      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-200">Browser only</p>
                  <p className="text-xs text-zinc-500">Stored in this browser</p>
                </button>
                <button
                  onClick={() => handleModeChange('server')}
                  disabled={encryptionAvailable === false}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    storageMode === 'server'
                      ? 'border-zinc-500 bg-zinc-800'
                      : encryptionAvailable === false
                        ? 'border-zinc-800 bg-zinc-900/50 opacity-50 cursor-not-allowed'
                        : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-200">Save to account</p>
                  <p className="text-xs text-zinc-500">
                    {encryptionAvailable === false
                      ? 'Not available — server encryption not configured'
                      : 'Encrypted, works across devices'}
                  </p>
                </button>
              </div>
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Provider</label>
              <ProviderPicker value={provider} onChange={handleProviderChange} />
            </div>

            {/* Model selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Model</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {getProviderConfig(provider).models.map((m) => (
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

            {/* Expiry selection (server mode only) */}
            {storageMode === 'server' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Key Expiry</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiryDays(opt.value)}
                      className={`p-2.5 rounded-lg border text-center transition-colors ${
                        expiryDays === opt.value
                          ? 'border-zinc-500 bg-zinc-800'
                          : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
                      }`}
                    >
                      <p className="text-sm font-medium text-zinc-200">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* API Key input */}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-400">API Key</span>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setSaved(false);
                    setTestStatus('idle');
                  }}
                  placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                  className="w-full px-3 py-2 pr-16 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono text-sm"
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
            </label>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {storageMode === 'browser' ? (
                <button
                  onClick={handleSaveBrowser}
                  disabled={!apiKey.trim() || testStatus === 'testing'}
                  className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Save & Test Key'}
                </button>
              ) : (
                <button
                  onClick={handleSaveServer}
                  disabled={!apiKey.trim() || serverLoading}
                  className="px-4 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {serverLoading ? 'Saving...' : 'Encrypt & Save to Account'}
                </button>
              )}
            </div>
          </>
        )}

        {/* Status */}
        {testStatus === 'error' && (
          <div className="text-sm text-red-400">
            <p>{storageMode === 'server' ? 'Save failed' : 'Key validation failed'}</p>
            {testError && <p className="text-xs text-red-400/70 mt-1">{testError}</p>}
          </div>
        )}

        {/* Privacy disclosure */}
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">{DISCLOSURE[storageMode]}</p>
        </div>
      </div>
    </div>
  );
}
