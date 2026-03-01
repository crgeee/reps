import { useState, useEffect } from 'react';
import { getCalendarToken, generateCalendarToken, downloadMarkdownExport } from '../api';

export default function ExportView() {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getCalendarToken()
      .then((res) => {
        setToken(res.token);
        if ('url' in res) setUrl((res as { url: string }).url);
      })
      .catch((e) => { console.error('Failed to load calendar token:', e); })
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    if (token && !confirm('This will invalidate your current subscription URL. Continue?')) return;
    setGenerating(true);
    try {
      const res = await generateCalendarToken();
      setToken(res.token);
      setUrl(res.url);
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleMarkdownExport() {
    setExporting(true);
    try {
      await downloadMarkdownExport();
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold tracking-tight">Export</h1>

      {/* Calendar subscription */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Calendar Subscription</h2>
        <p className="text-xs text-zinc-500">
          Subscribe to your review schedule in Apple Calendar, Google Calendar, or any app that
          supports iCal feeds.
        </p>

        {loading ? (
          <div className="text-xs text-zinc-600">Loading...</div>
        ) : token && url ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 font-mono truncate"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href={url}
                className="px-3 py-2 text-xs bg-amber-500 text-zinc-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
              >
                Open in Calendar
              </a>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
              >
                {generating ? 'Regenerating...' : 'Regenerate URL'}
              </button>
            </div>
            <p className="text-[10px] text-zinc-700">
              Regenerating will invalidate the current URL. Any existing subscriptions will stop
              updating.
            </p>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Subscribe URL'}
          </button>
        )}

        <div className="text-[10px] text-zinc-600 space-y-1 pt-2">
          <p>
            <strong>Apple Calendar:</strong> Click "Open in Calendar" or copy the URL, then File →
            New Calendar Subscription.
          </p>
          <p>
            <strong>Google Calendar:</strong> Copy the URL, replace{' '}
            <code className="text-zinc-500">webcal://</code> with{' '}
            <code className="text-zinc-500">https://</code>, then Settings → Add calendar → From
            URL.
          </p>
        </div>
      </section>

      {/* Markdown export */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">Markdown Export</h2>
        <p className="text-xs text-zinc-500">
          Download all tasks and notes as a Markdown file, grouped by topic.
        </p>
        <button
          onClick={handleMarkdownExport}
          disabled={exporting}
          className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          {exporting ? 'Exporting...' : 'Download Markdown'}
        </button>
      </section>
    </div>
  );
}
