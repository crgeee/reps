export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 text-zinc-300 text-sm leading-relaxed">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-100 mb-1">Privacy Policy</h1>
        <p className="text-zinc-500 text-xs">Last updated: February 25, 2026</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">What We Collect</h2>
        <ul className="list-disc list-inside space-y-1 text-zinc-400">
          <li>Email address (for authentication via magic link)</li>
          <li>Task data you create (titles, notes, review history)</li>
          <li>Basic usage data (page views, feature usage)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">How Data Is Stored</h2>
        <p className="text-zinc-400">
          Your data is stored in a PostgreSQL database on a Hetzner VPS located in Germany.
          All connections are encrypted via TLS. We do not sell or share your data with third parties
          for marketing purposes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Third-Party Services</h2>
        <ul className="list-disc list-inside space-y-1 text-zinc-400">
          <li><strong className="text-zinc-300">Anthropic</strong> &mdash; AI-powered interview coaching and question generation</li>
          <li><strong className="text-zinc-300">Resend</strong> &mdash; transactional email (magic links, daily digests)</li>
          <li><strong className="text-zinc-300">Pushover</strong> &mdash; optional push notifications</li>
        </ul>
        <p className="text-zinc-400">
          When you use AI features, your task titles and notes may be sent to Anthropic&rsquo;s API
          to generate questions, evaluations, and coaching messages. Anthropic does not use API inputs
          for training.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Data Retention &amp; Deletion</h2>
        <p className="text-zinc-400">
          Your data is retained as long as your account is active. You can delete individual tasks
          at any time. To delete your entire account and all associated data, contact us at the
          email below.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Contact</h2>
        <p className="text-zinc-400">
          Questions about this policy? Reach out at{' '}
          <a href="mailto:privacy@reps-prep.duckdns.org" className="text-amber-500 hover:text-amber-400 transition-colors">
            privacy@reps-prep.duckdns.org
          </a>
        </p>
      </section>
    </div>
  );
}
