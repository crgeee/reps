export interface BlogPostData {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string;
  content: string; // plain text paragraphs separated by \n\n
}

export const blogPosts: BlogPostData[] = [
  {
    slug: 'why-we-built-a-priority-algorithm',
    title: 'Why We Built a Priority Algorithm for Interview Prep',
    date: '2026-03-05',
    summary:
      'Spaced repetition tells you when to review — but not what to work on first. We built a 5-factor scoring system to fix that.',
    content: `If you've ever used spaced repetition for anything — flashcards, language learning, interview prep — you know the feeling. You open the app, and there are 10 items due today. They're all "due." The algorithm says review them all. But you have 45 minutes before work, not four hours. Which ones actually matter?

That's the problem we ran into building reps. The SM-2 algorithm is excellent at deciding when you should see something again. Score a topic poorly and it comes back tomorrow. Nail it and you won't see it for two weeks. The spacing math is sound, backed by decades of cognitive science research. But SM-2 has a blind spot: it treats every due item as equally important. A system design topic you've failed three times gets the same priority as a behavioral question you slightly under-reviewed. That felt wrong.

So we built a priority scoring system on top of SM-2. Instead of just asking "is this due?", we ask "how urgently does this need attention?" The score is a weighted combination of five factors, each capturing a different dimension of what makes a topic important right now.

The first factor is overdue urgency, weighted at 30%. This is the most intuitive one — how far past its review date is a task? Something three days overdue scores higher than something due today. The further you fall behind, the more the forgetting curve works against you, so overdue items get the heaviest weight.

Next is deadline pressure at 25%. If you have a system design interview in two days, that topic matters more than one with no deadline. The scoring ramps up as deadlines approach, creating natural urgency without you needing to manually reprioritize. No deadline? This factor scores zero and the other weights compensate.

Difficulty accounts for 20% of the score. We measure this through the SM-2 ease factor — the number that tracks how hard a topic is for you specifically. A low ease factor means you've historically struggled with it. These harder topics need more reps to stick, so they get a boost. Easy topics you've already internalized can wait.

Staleness carries 15% weight. Some tasks just haven't been touched in a while, even if they're technically not overdue yet. A topic last reviewed three weeks ago is rustier than one you saw yesterday, even if both are due today. This factor ensures nothing quietly rots in the backlog.

The final 10% comes from AI weakness detection. Every time you complete a practice session, our AI evaluator scores your answer on clarity, specificity, and depth. Score low on clarity for a coding topic? That topic's priority gets a bump. This is where the system gets genuinely adaptive — it's not just tracking when you review, but how well you perform.

The real power is in how these three systems reinforce each other. SM-2 decides when a topic needs review based on your recall history. The priority algorithm decides what to work on first when multiple topics compete for your time. And the AI evaluator measures how well you actually understand the material, feeding scores back into both systems. Score poorly and the topic comes back sooner (SM-2) with higher urgency (priority). Score well and it gracefully fades into longer intervals.

Together, these three systems create an adaptive study plan that gets smarter the more you use it. You don't need to manually organize your prep or guess what to focus on. Just open reps, work the top of the list, and trust that the math is putting the right thing in front of you.`,
  },
];
