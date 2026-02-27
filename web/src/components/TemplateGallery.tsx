import { useState, useEffect } from 'react';
import type { CollectionTemplate, Collection, User } from '../types';
import { getTemplates } from '../api';
import TemplateCard from './TemplateCard';
import CreateFromTemplate from './CreateFromTemplate';
import { Plus } from 'lucide-react';

interface TemplateGalleryProps {
  onCollectionCreated: (collection: Collection) => void;
  onNavigate: (view: string) => void;
  user: User;
}

export default function TemplateGallery({
  onCollectionCreated,
  onNavigate,
  user,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<CollectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CollectionTemplate | null>(null);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  const myTemplates = templates.filter((t) => !t.isSystem && t.userId === user.id);
  const systemTemplates = templates.filter((t) => t.isSystem);

  function handleCreated(collection: Collection) {
    setSelectedTemplate(null);
    onCollectionCreated(collection);
    onNavigate('tasks');
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-5 w-80 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-800 rounded" />
                <div className="h-5 w-32 bg-zinc-800 rounded" />
              </div>
              <div className="h-4 w-full bg-zinc-800/60 rounded" />
              <div className="h-4 w-2/3 bg-zinc-800/60 rounded" />
              <div className="flex gap-1.5 mt-3">
                <div className="h-5 w-16 bg-zinc-800/40 rounded-full" />
                <div className="h-5 w-20 bg-zinc-800/40 rounded-full" />
                <div className="h-5 w-14 bg-zinc-800/40 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Start a new collection</h1>
          <p className="text-red-400 mt-1">{error}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            getTemplates()
              .then(setTemplates)
              .catch((err) =>
                setError(err instanceof Error ? err.message : 'Failed to load templates'),
              )
              .finally(() => setLoading(false));
          }}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Start a new collection</h1>
        <p className="text-zinc-400 mt-1">Choose a template or start from scratch</p>
      </div>

      {myTemplates.length > 0 && (
        <div>
          <h2 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-3">
            My Templates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => setSelectedTemplate(template)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium mb-3">
          Templates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => setSelectedTemplate(template)}
            />
          ))}
          <button
            onClick={() => onNavigate('tasks')}
            className="border-2 border-dashed border-zinc-700 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-all cursor-pointer min-h-[160px]"
          >
            <Plus className="w-8 h-8" />
            <span className="text-sm font-medium">Start from scratch</span>
          </button>
        </div>
      </div>

      {selectedTemplate && (
        <CreateFromTemplate
          template={selectedTemplate}
          onCreated={handleCreated}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}
