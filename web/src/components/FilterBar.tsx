import type { Topic, TaskStatus } from '../types';
import { TOPICS, TOPIC_LABELS, STATUSES, STATUS_LABELS } from '../types';
import type { FilterState, DueFilter, SortField } from '../hooks/useFilteredTasks';

interface FilterBarProps {
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  hideStatus?: boolean;
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

export default function FilterBar({ filters, setFilter, resetFilters, hideStatus }: FilterBarProps) {
  const hasActiveFilters = filters.topic !== 'all' || filters.status !== 'all' ||
    filters.due !== 'all' || filters.search !== '' || filters.sortField !== 'created';

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

      <div className="flex flex-wrap items-center gap-3">
        {/* Topic chips */}
        <ChipGroup
          label="Topic"
          value={filters.topic}
          options={[{ value: 'all' as const, label: 'All' }, ...TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }))]}
          onChange={(v) => setFilter('topic', v as Topic | 'all')}
        />

        {/* Status chips (hidden on board) */}
        {!hideStatus && (
          <ChipGroup
            label="Status"
            value={filters.status}
            options={[{ value: 'all' as const, label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
            onChange={(v) => setFilter('status', v as TaskStatus | 'all')}
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
        <div className="flex items-center gap-1 ml-auto">
          <select
            value={filters.sortField}
            onChange={(e) => setFilter('sortField', e.target.value as SortField)}
            className="bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 px-2 py-1.5 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider mr-1">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            value === o.value
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
