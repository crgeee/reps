import { Brain, Target, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';

const intervalSteps = ['Day 1', 'Day 6', 'Day 15', 'Day 36', 'Day 90'];

const priorityFactors = [
  {
    name: 'Overdue Urgency',
    weight: '30%',
    width: 'w-[30%]',
    description: 'How far past due for review',
  },
  {
    name: 'Deadline Pressure',
    weight: '25%',
    width: 'w-[25%]',
    description: 'How close the deadline is',
  },
  {
    name: 'Difficulty',
    weight: '20%',
    width: 'w-[20%]',
    description: 'Based on ease factor (harder items surface more)',
  },
  { name: 'Staleness', weight: '15%', width: 'w-[15%]', description: 'Days since last activity' },
  {
    name: 'AI Weakness',
    weight: '10%',
    width: 'w-[10%]',
    description: 'Low AI evaluation scores boost priority',
  },
];

const coachingSteps = ['Review', 'AI Question', 'Your Answer', 'AI Feedback', 'Priority Adjusts'];

const loopItems = [
  { label: 'SM-2', sublabel: 'When to review', icon: Brain },
  { label: 'Priority', sublabel: 'What to work on', icon: Target },
  { label: 'AI', sublabel: 'How well you performed', icon: Sparkles },
];

export default function HowItWorks() {
  return (
    <div className="space-y-16 pb-8">
      {/* Hero */}
      <section className="text-center space-y-4 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          The Science Behind Your Prep
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          reps combines three systems — spaced repetition, smart prioritization, and AI coaching —
          to make your interview prep more effective.
        </p>
      </section>

      {/* Section 1: Spaced Repetition */}
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={20} className="text-amber-500" />
            <h2 className="text-2xl font-bold text-zinc-100">Spaced Repetition</h2>
          </div>
          <p className="text-lg text-zinc-400">Review at the moment you're about to forget</p>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">
          The SM-2 algorithm, developed in 1987 by Piotr Wozniak, schedules reviews at increasing
          intervals. Instead of cramming, you review material right before you would forget it —
          strengthening long-term retention with each repetition.
        </p>

        {/* Interval timeline */}
        <div className="flex items-center gap-2 flex-wrap py-4">
          {intervalSteps.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm font-mono text-amber-500">
                {step}
              </div>
              {i < intervalSteps.length - 1 && (
                <ArrowRight size={16} className="text-zinc-600 shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
          <p>
            After each review, you rate your recall from{' '}
            <span className="text-zinc-200 font-medium">0</span> (complete blackout) to{' '}
            <span className="text-zinc-200 font-medium">5</span> (perfect recall). Ratings of 3 or
            above advance the interval; anything below resets it.
          </p>
          <p>
            Each item has an <span className="text-amber-500 font-medium">ease factor</span> that
            starts at 2.5 and adjusts based on your performance. Harder items get reviewed more
            frequently. Easier items space out further.
          </p>
        </div>
      </section>

      {/* Section 2: Priority Scoring */}
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target size={20} className="text-amber-500" />
            <h2 className="text-2xl font-bold text-zinc-100">Priority Scoring</h2>
          </div>
          <p className="text-lg text-zinc-400">Know what to work on next</p>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">
          A weighted formula answers the question: "what should I focus on right now?" Five factors
          combine into a single priority score that surfaces the most impactful tasks first.
        </p>

        {/* Factors table */}
        <div className="space-y-3">
          {priorityFactors.map((factor) => (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-200 font-medium">{factor.name}</span>
                <span className="text-zinc-500 font-mono text-xs">{factor.weight}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full bg-amber-500/80 rounded-full ${factor.width}`} />
              </div>
              <p className="text-xs text-zinc-500">{factor.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: AI Coaching */}
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={20} className="text-amber-500" />
            <h2 className="text-2xl font-bold text-zinc-100">AI Interview Coach</h2>
          </div>
          <p className="text-lg text-zinc-400">Practice with structured feedback</p>
        </div>

        <div className="space-y-3 text-sm text-zinc-400 leading-relaxed">
          <p>
            Claude generates interview questions tailored to each topic — coding problems with
            constraints, system design scenarios at scale, behavioral prompts in STAR format, and
            paper discussion questions.
          </p>
          <p>
            Your answers are evaluated on three dimensions:{' '}
            <span className="text-zinc-200 font-medium">clarity</span> (1-5),{' '}
            <span className="text-zinc-200 font-medium">specificity</span> (1-5), and{' '}
            <span className="text-zinc-200 font-medium">mission alignment</span> (1-5). Each
            evaluation includes targeted feedback and a suggested improvement.
          </p>
          <p>
            Low evaluation scores feed back into the priority system, ensuring weak areas surface
            more frequently in your review queue.
          </p>
        </div>

        {/* Coaching flow */}
        <div className="flex items-center gap-2 flex-wrap py-4">
          {coachingSteps.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300">
                {step}
              </div>
              {i < coachingSteps.length - 1 && (
                <ArrowRight size={16} className="text-zinc-600 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: The Feedback Loop */}
      <section className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={20} className="text-amber-500" />
            <h2 className="text-2xl font-bold text-zinc-100">The Feedback Loop</h2>
          </div>
        </div>

        {/* Triangular layout */}
        <div className="flex flex-col items-center gap-6 py-4">
          {/* Top node */}
          <div className="flex flex-col items-center gap-1">
            <div className="bg-zinc-800 border border-amber-500/30 rounded-lg p-4 text-center w-48">
              <Brain size={24} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-200">{loopItems[0]!.label}</p>
              <p className="text-xs text-zinc-500">{loopItems[0]!.sublabel}</p>
            </div>
          </div>

          {/* Connecting arrows */}
          <div className="flex items-center gap-1 text-zinc-600">
            <ArrowRight size={14} className="rotate-[135deg]" />
            <span className="text-xs text-zinc-600">reinforces</span>
            <ArrowRight size={14} className="rotate-45" />
          </div>

          {/* Bottom two nodes */}
          <div className="flex items-center gap-8">
            <div className="bg-zinc-800 border border-amber-500/30 rounded-lg p-4 text-center w-48">
              <Target size={24} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-200">{loopItems[1]!.label}</p>
              <p className="text-xs text-zinc-500">{loopItems[1]!.sublabel}</p>
            </div>
            <div className="flex items-center gap-1 text-zinc-600">
              <ArrowRight size={14} />
            </div>
            <div className="bg-zinc-800 border border-amber-500/30 rounded-lg p-4 text-center w-48">
              <Sparkles size={24} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-200">{loopItems[2]!.label}</p>
              <p className="text-xs text-zinc-500">{loopItems[2]!.sublabel}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">
          Each system reinforces the others. SM-2 schedules reviews. Priority decides what's most
          important. AI measures how well you're doing. Together, they create a focused, adaptive
          study plan.
        </p>
      </section>
    </div>
  );
}
