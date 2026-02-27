import type { CollectionTemplate } from '../types';

interface TemplateCardProps {
  template: CollectionTemplate;
  onClick: () => void;
}

export default function TemplateCard({ template, onClick }: TemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all cursor-pointer text-left w-full"
    >
      <div className="flex items-center gap-3">
        {template.icon && (
          <span className="text-[2rem] leading-none flex-shrink-0">{template.icon}</span>
        )}
        <h3 className="text-lg font-semibold text-zinc-100 truncate">{template.name}</h3>
      </div>

      {template.description && (
        <p className="text-sm text-zinc-400 line-clamp-2 mt-2">{template.description}</p>
      )}

      {template.statuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {template.statuses.map((status) => (
            <span
              key={status.id}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: status.color
                  ? `${status.color}33`
                  : 'rgba(113, 113, 122, 0.2)',
                color: status.color ?? '#a1a1aa',
              }}
            >
              {status.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-4 text-xs text-zinc-500">
        {template.srEnabled && (
          <span className="text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">SR</span>
        )}
        <span>{template.defaultView === 'board' ? 'Board' : 'List'}</span>
        {template.tasks.length > 0 && (
          <span>
            {template.tasks.length} starter {template.tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        )}
      </div>
    </button>
  );
}
