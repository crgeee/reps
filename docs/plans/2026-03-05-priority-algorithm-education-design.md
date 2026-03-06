# Priority Algorithm, Educational UX & Marketing Update

**Date:** 2026-03-05
**Status:** Approved

---

## Summary

Add a weighted priority scoring algorithm to reps, expose it throughout the app with educational tooltips, create a "How It Works" page explaining all three systems (SM-2, priority scoring, AI coaching), enhance the login page marketing copy, and publish a launch blog post.

---

## 1. Priority Algorithm

### Score

Each task gets a **priority score (0-100)** computed server-side and returned with task data.

```
priority = 0.30 * overdue_urgency
         + 0.25 * deadline_pressure
         + 0.20 * difficulty
         + 0.15 * staleness
         + 0.10 * ai_weakness
```

### Factor Calculations (each normalized 0-100)

| Factor            | Formula                                    | Intuition                                                     |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------- |
| overdue_urgency   | `min(100, days_overdue * 15)`              | 0 if not overdue, maxes at ~7 days overdue                    |
| deadline_pressure | `max(0, 100 - days_until_deadline * 10)`   | 100 at deadline, 0 if 10+ days away, null deadline = 0        |
| difficulty        | `min(100, (3.0 - easeFactor) / 1.7 * 100)` | EF 1.3 (hardest) = 100, EF 3.0+ = 0                           |
| staleness         | `min(100, days_since_last_activity * 3.3)` | Maxes at ~30 days inactive                                    |
| ai_weakness       | `100 - avg_ai_score * 20`                  | Avg of clarity+specificity+missionAlignment (1-5), low = high |

### Implementation

- New module: `server/lib/priority.ts`
- Computed on read (GET /tasks, GET /tasks/due), not persisted in DB
- New sort option "Priority" in FilterBar (default sort on Dashboard)
- GET /tasks/due returns tasks sorted by priority descending
- Priority response shape: `{ score: number, factors: { overdue_urgency, deadline_pressure, difficulty, staleness, ai_weakness } }`

### Dashboard Changes

- Due tasks table sorted by priority score (highest first)
- New "Priority" column with color gradient (red 80+, amber 50-79, green <50)
- Review session uses priority-sorted order

---

## 2. Educational Tooltips

New `<InfoTooltip />` component — `(i)` icon that opens a popover on click/hover.

| Location               | Metric         | Content                                                                                                  |
| ---------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| Dashboard due table    | Priority score | Factor breakdown with mini bar chart showing each factor's contribution + "Learn more" link              |
| Dashboard topics table | Avg EF         | "Ease Factor from SM-2. Starts at 2.5, drops when you struggle, rises when you nail it."                 |
| Dashboard topics table | Confidence     | "Based on Ease Factor: Strong (2.5+), Moderate (2.0-2.5), Weak (1.5-2.0), Low (<1.5)"                    |
| Review session         | SM-2 rating    | "SuperMemo-2 quality rating. 0-2: forgot (reset). 3: hard. 4: good. 5: perfect. Determines next review." |
| Review session         | AI scores      | "Scored by Claude. Low scores boost this task's priority."                                               |
| Task detail            | Interval       | "Days until next review. Grows exponentially: 1->6->15->36->..."                                         |
| Task detail            | Repetitions    | "Consecutive successful reviews (quality 3+). Resets to 0 on failure."                                   |

Each tooltip: 2-3 sentences max, optional "Learn more" link to /how-it-works.

---

## 3. "How It Works" Page

Route: `/how-it-works`
Linked from: nav sidebar, login page, tooltip "Learn more" links

### Sections

**Hero:** "The Science Behind Your Prep" — reps combines three systems: spaced repetition, smart prioritization, and AI coaching.

**Section 1: Spaced Repetition (SM-2)**

- What: algorithm from 1987 scheduling reviews at optimal intervals
- Visual: animated timeline showing interval growth (1->6->15->36 days)
- How: rate 0-5 after review, SM-2 calculates next review date
- Key insight: "Review at the moment you're about to forget"

**Section 2: Priority Scoring**

- What: weighted formula answering "what should I work on next?"
- Visual: 5 factors as stacked bar chart with example values
- Interactive: mock task card where hovering priority score highlights factor contributions
- Weights shown as table

**Section 3: AI Coaching**

- What: Claude generates questions, evaluates answers, provides structured feedback
- Feedback loop: low AI scores boost task priority
- The cycle: review -> AI question -> answer -> feedback -> priority adjusts

**Section 4: The Feedback Loop**

- Visual: circular diagram — SM-2 (when) + Priority (what) + AI (how well)
- "Each system reinforces the others"

Static content, no API calls. Dark theme consistent with app.

---

## 4. Login Page Enhancement

### Feature Cards Update

| Current   | New Title            | New Copy                                                                                            |
| --------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| Organize  | Smart Prioritization | "A weighted algorithm scores every task on urgency, difficulty, staleness, and AI feedback."        |
| Remember  | Spaced Repetition    | "SM-2 schedules reviews at the moment you're about to forget. Intervals grow from 1 day to months." |
| Practice  | AI Interview Coach   | "Claude generates questions, evaluates answers on clarity, specificity, and mission alignment."     |
| Integrate | (keep as-is)         | MCP integration                                                                                     |

### New Section

Below feature cards: "How it works" — 3-step visual (Schedule -> Review -> Improve) with "Learn more" link to /how-it-works.

---

## 5. Blog

Route: `/blog` (listing) and `/blog/:slug` (individual posts)

### Implementation

- `web/src/components/Blog.tsx` — blog listing page
- `web/src/components/BlogPost.tsx` — individual post renderer
- Blog entries as static data objects in `web/src/data/blog-posts.ts` (no CMS)
- Linked from footer and login page

### First Post

**Title:** "Why We Built a Priority Algorithm for Interview Prep"
**Length:** ~500 words
**Content:**

- The problem: spaced repetition tells you _when_ but not _what first_
- The solution: 5-factor weighted scoring
- How AI evaluation closes the loop
- Formula explained conversationally

---

## Files to Create/Modify

### New Files

- `server/lib/priority.ts` — priority scoring module
- `web/src/components/InfoTooltip.tsx` — reusable tooltip component
- `web/src/components/HowItWorks.tsx` — educational page
- `web/src/components/Blog.tsx` — blog listing
- `web/src/components/BlogPost.tsx` — blog post renderer
- `web/src/data/blog-posts.ts` — static blog content

### Modified Files

- `server/routes/tasks.ts` — attach priority score to task responses
- `web/src/components/Dashboard.tsx` — priority column, sort by priority, tooltips
- `web/src/components/FilterBar.tsx` — new "Priority" sort option
- `web/src/hooks/useFilteredTasks.ts` — priority sort logic
- `web/src/components/ReviewSession.tsx` — tooltips on SM-2 rating and AI scores
- `web/src/components/LoginPage.tsx` — enhanced feature cards + how-it-works teaser
- `web/src/components/TopicProgress.tsx` — tooltips on EF and confidence
- `web/src/router.tsx` — new routes (/how-it-works, /blog, /blog/:slug)
- `web/index.html` — updated meta description and structured data
