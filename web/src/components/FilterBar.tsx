import type { Topic } from '../types';
import { TOPICS, TOPIC_LABELS, STATUSES, STATUS_LABELS } from '../types';
import type { FilterState, DueFilter, SortField, GroupBy } from '../hooks/useFilteredTasks';

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  hideStatus?: boolean;
  statusOptions?: { value: string; label: string }[];
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'this-week', label: 'This Week' },
  { value: 'no-deadline', label: 'No Deadline' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'created', label: 'Created' },
  { value: 'next-review', label: 'Next Review' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'ease-factor', label: 'Ease Factor' },
];

export default function FilterBar({
  filters,
  setFilter,
  resetFilters,
  hideStatus,
  statusOptions,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.topic !== 'all' ||
    filters.status !== 'all' ||
    filters.due !== 'all' ||
    filters.search !== '' ||
    filters.sortField !== 'created' ||
    !filters.hideCompleted ||
    filters.groupBy !== 'none';

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        value={filters.search}
        onChange={(e) => setFilter('search', e.target.value)}
        placeholder="Search tasks..."
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Topic chips */}
        <ChipGroup
          label="Topic"
          value={filters.topic}
          options={[
            { value: 'all' as const, label: 'All' },
            ...TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] })),
          ]}
          onChange={(v) => setFilter('topic', v as Topic | 'all')}
        />

        {/* Status chips (hidden on board) */}
        {!hideStatus && (
          <ChipGroup
            label="Status"
            value={filters.status}
            options={[
              { value: 'all' as const, label: 'All' },
              ...(statusOptions ?? STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))),
            ]}
            onChange={(v) => setFilter('status', v)}
          />
        )}

        {/* Due date chips */}
        <ChipGroup
          label="Due"
          value={filters.due}
          options={DUE_OPTIONS}
          onChange={(v) => setFilter('due', v as DueFilter)}
        />

        {/* Sort */}
        <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-auto">
          <select
            value={filters.sortField}
            onChange={(e) => setFilter('sortField', e.target.value as SortField)}
            className="bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 px-2 py-1.5 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc')}
            className="text-zinc-500 hover:text-zinc-300 px-1.5 py-1 text-xs"
            title={filters.sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sortDir === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>

        {/* Hide completed */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.hideCompleted}
            onChange={(e) => setFilter('hideCompleted', e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-zinc-400 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
          />
          Hide done
        </label>

        {/* Group by */}
        <select
          value={filters.groupBy}
          onChange={(e) => setFilter('groupBy', e.target.value as GroupBy)}
          className="bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 px-2 py-1.5 focus:outline-none"
        >
          <option value="none">No grouping</option>
          <option value="status">Group by Status</option>
          <option value="topic">Group by Topic</option>
        </select>

        {/* Reset */}
        {hasActiveFilters && (
          <button onClick={resetFilters} className="text-xs text-zinc-500 hover:text-zinc-300">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0">
      <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mr-1 flex-shrink-0">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
            value === o.value
              ? 'bg-zinc-700 text-zinc-100 font-medium'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
