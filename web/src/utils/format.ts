export function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (ua.includes('reps-cli')) return 'reps CLI';
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0];
  const os = ua
    .match(/(Mac OS X|Windows NT|Linux|Android|iOS)[\s/]?[\d._]*/)?.[0]
    ?.replace(/_/g, '.');
  if (browser && os) return `${browser.split('/')[0]} on ${os}`;
  if (browser) return browser.split('/')[0] ?? ua;
  return ua.length > 60 ? ua.slice(0, 60) + '...' : ua;
}

export function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
