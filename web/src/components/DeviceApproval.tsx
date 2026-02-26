import { useState } from 'react';
import { approveDevice, denyDevice } from '../api';

export default function DeviceApproval() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'approving' | 'approved' | 'denied' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    if (!code.trim()) return;
    setStatus('approving');
    setError(null);
    try {
      await approveDevice(code.trim().toUpperCase());
      setStatus('approved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve device');
      setStatus('error');
    }
  }

  async function handleDeny() {
    if (!code.trim()) return;
    setError(null);
    try {
      await denyDevice(code.trim().toUpperCase());
      setStatus('denied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny device');
      setStatus('error');
    }
  }

  if (status === 'approved') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Device Approved</h1>
        <div className="p-4 bg-green-950 border border-green-800 rounded-lg text-green-200">
          The CLI device has been approved and is now connected.
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Device Denied</h1>
        <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400">
          The device authorization request was denied.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Approve CLI Device</h1>
      <p className="text-zinc-400">Enter the code shown in your terminal to connect the CLI.</p>

      {error && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-sm">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter 8-character code"
          maxLength={8}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 mb-4 font-mono text-lg tracking-widest text-center"
        />
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={code.length < 8 || status === 'approving'}
            className="flex-1 py-3 bg-zinc-100 text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {status === 'approving' ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={handleDeny}
            disabled={code.length < 8}
            className="flex-1 py-3 bg-zinc-800 text-zinc-300 font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
