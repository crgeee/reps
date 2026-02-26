import type { Task, Topic } from '../types';
import { TOPICS, TOPIC_LABELS, TOPIC_COLORS } from '../types';
import { useFilteredTasks } from '../hooks/useFilteredTasks';
import FilterBar from './FilterBar';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  onRefresh: () => void;
}

export default function TaskList({ tasks, onRefresh }: TaskListProps) {
  const { filters, setFilter, resetFilters, filtered } = useFilteredTasks(tasks);

  const grouped = TOPICS.reduce<Record<Topic, Task[]>>((acc, topic) => {
    const topicTasks = filtered.filter((t) => t.topic === topic);
    if (topicTasks.length > 0) acc[topic] = topicTasks;
    return acc;
  }, {} as Record<Topic, Task[]>);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>

      <FilterBar filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

      {Object.entries(grouped).length === 0 && (
        <p className="text-zinc-500 py-12 text-center">No tasks found.</p>
      )}

      {Object.entries(grouped).map(([topic, topicTasks]) => (
        <div key={topic}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${TOPIC_COLORS[topic as Topic]}`} />
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {TOPIC_LABELS[topic as Topic]}
            </h2>
            <span className="text-xs text-zinc-600">{topicTasks.length}</span>
          </div>
          <div className="space-y-2">
            {topicTasks.map((task) => (
              <TaskCard key={task.id} task={task} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
