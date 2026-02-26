export default function TermsOfService() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 text-zinc-300 text-sm leading-relaxed">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-100 mb-1">Terms of Service</h1>
        <p className="text-zinc-500 text-xs">Last updated: February 25, 2026</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Acceptance of Terms</h2>
        <p className="text-zinc-400">
          By accessing or using reps, you agree to be bound by these terms. If you do not agree,
          do not use the service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Description of Service</h2>
        <p className="text-zinc-400">
          reps is an interview preparation tracker with spaced repetition scheduling,
          AI-powered coaching, and progress analytics. The service is provided as-is and may
          change without notice.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">User Responsibilities</h2>
        <ul className="list-disc list-inside space-y-1 text-zinc-400">
          <li>You are responsible for keeping your account credentials secure</li>
          <li>You agree not to abuse the service or use it for unlawful purposes</li>
          <li>You are responsible for the content you create within the app</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">AI-Generated Content</h2>
        <p className="text-zinc-400">
          reps uses AI (powered by Anthropic&rsquo;s Claude) to generate interview questions,
          evaluate answers, and provide coaching. AI-generated content is for practice purposes
          only and should not be taken as professional advice. Responses may contain inaccuracies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Intellectual Property</h2>
        <p className="text-zinc-400">
          reps is open-source software released under the{' '}
          <a
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-400 transition-colors"
          >
            MIT License
          </a>
          . Your task data and notes remain yours.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Limitation of Liability</h2>
        <p className="text-zinc-400">
          reps is provided &ldquo;as is&rdquo; without warranty of any kind. We are not liable for
          any damages arising from your use of the service, including but not limited to data loss,
          service interruptions, or reliance on AI-generated content.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Termination</h2>
        <p className="text-zinc-400">
          We reserve the right to suspend or terminate accounts that violate these terms.
          You may stop using the service at any time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Changes to Terms</h2>
        <p className="text-zinc-400">
          We may update these terms from time to time. Continued use of the service after changes
          constitutes acceptance of the new terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">Contact</h2>
        <p className="text-zinc-400">
          Questions about these terms? Reach out at{' '}
          <a href="mailto:legal@reps-prep.duckdns.org" className="text-amber-500 hover:text-amber-400 transition-colors">
            legal@reps-prep.duckdns.org
          </a>
        </p>
      </section>
    </div>
  );
}
