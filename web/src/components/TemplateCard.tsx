import type { CollectionTemplate } from '../types';
import { pillStyle } from '../utils/ui';

interface TemplateCardProps {
  template: CollectionTemplate;
  onClick: () => void;
}

export default function TemplateCard({ template, onClick }: TemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-all cursor-pointer text-left w-full"
    >
      <div className="flex items-center gap-2.5">
        {template.icon && (
          <span className="text-xl leading-none flex-shrink-0">{template.icon}</span>
        )}
        <h3 className="text-sm font-semibold text-zinc-100 truncate">{template.name}</h3>
      </div>

      {template.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 mt-1.5">{template.description}</p>
      )}

      {template.statuses.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {template.statuses.map((status) => (
            <span
              key={status.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={pillStyle(status.color)}
            >
              {status.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5 text-[10px] text-zinc-500">
        {template.srEnabled && (
          <span className="text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">SR</span>
        )}
        <span>{template.defaultView === 'board' ? 'Board' : 'List'}</span>
        {template.tasks.length > 0 && (
          <span>
            {template.tasks.length} {template.tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        )}
      </div>
    </button>
  );
}
