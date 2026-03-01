import { useState, useEffect, useCallback } from 'react';
import { X, ArrowLeft, Plus } from 'lucide-react';
import type { CollectionTemplate, Collection } from '../types';
import { COLOR_SWATCHES } from '../types';
import { getTemplates, createCollection, createCollectionFromTemplate } from '../api';
import TemplateCard from './TemplateCard';

interface CreateCollectionModalProps {
  onCreated: (collection: Collection) => void;
  onClose: () => void;
}

const ICON_OPTIONS = ['', '📚', '💻', '🎯', '🧠', '📝', '🔬', '🎨', '⚡', '🏆', '📊', '🔧'];

export default function CreateCollectionModal({ onCreated, onClose }: CreateCollectionModalProps) {
  const [step, setStep] = useState<'pick' | 'customize'>('pick');
  const [templates, setTemplates] = useState<CollectionTemplate[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CollectionTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
  const [srEnabled, setSrEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates once on mount
  useEffect(() => {
    let cancelled = false;
    getTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleSelectTemplate(template: CollectionTemplate) {
    setSelectedTemplate(template);
    setName(template.name);
    setIcon(template.icon ?? '');
    setColor(template.color ?? COLOR_SWATCHES[0]);
    setSrEnabled(template.srEnabled);
    setError(null);
    setStep('customize');
  }

  function handleSelectBlank() {
    setSelectedTemplate(null);
    setName('');
    setIcon('');
    setColor(COLOR_SWATCHES[0]);
    setSrEnabled(false);
    setError(null);
    setStep('customize');
  }

  function handleBack() {
    setStep('pick');
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let collection: Collection;
      if (selectedTemplate) {
        collection = await createCollectionFromTemplate({
          templateId: selectedTemplate.id,
          name: name.trim(),
          color,
        });
      } else {
        collection = await createCollection({
          name: name.trim(),
          icon: icon || undefined,
          color,
          srEnabled,
        });
      }
      onCreated(collection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setSubmitting(false);
    }
  }

  const systemTemplates = templates?.filter((t) => t.isSystem) ?? [];
  const userTemplates = templates?.filter((t) => !t.isSystem) ?? [];

  return (
    <div
      className="anim-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create collection"
        className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-t-xl sm:rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5"
      >
        {step === 'pick' ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">New Collection</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template loading / list */}
            {templates === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-5 animate-pulse"
                  >
                    <div className="h-5 bg-zinc-700/50 rounded w-3/4 mb-3" />
                    <div className="h-3 bg-zinc-700/30 rounded w-full mb-2" />
                    <div className="h-3 bg-zinc-700/30 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {userTemplates.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-zinc-400 mb-2">My Templates</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {userTemplates.map((t) => (
                        <TemplateCard
                          key={t.id}
                          template={t}
                          onClick={() => handleSelectTemplate(t)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  {userTemplates.length > 0 && (
                    <h3 className="text-xs font-medium text-zinc-400 mb-2">Templates</h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {systemTemplates.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onClick={() => handleSelectTemplate(t)}
                      />
                    ))}

                    {/* Blank card */}
                    <button
                      onClick={handleSelectBlank}
                      className="border-2 border-dashed border-zinc-700 rounded-xl p-5 hover:border-zinc-500 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-zinc-200 min-h-[120px]"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-sm font-medium">Blank</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header with back button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  aria-label="Back"
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold text-zinc-100">
                  {selectedTemplate ? `From: ${selectedTemplate.name}` : 'New collection'}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                placeholder="Collection name"
                autoFocus
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${
                      icon === ic
                        ? 'bg-zinc-700 ring-2 ring-zinc-500 ring-offset-1 ring-offset-zinc-900'
                        : 'bg-zinc-800 hover:bg-zinc-750 border border-zinc-700'
                    }`}
                  >
                    {ic || <span className="text-zinc-500 text-xs">-</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Color swatches */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all duration-150 ${
                      color === c
                        ? 'ring-2 ring-zinc-400 ring-offset-2 ring-offset-zinc-900 scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* SR toggle — only for blank collections */}
            {!selectedTemplate && (
              <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={srEnabled}
                  onChange={(e) => setSrEnabled(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                Spaced repetition
              </label>
            )}

            {/* Status preview pills (template only) */}
            {selectedTemplate && selectedTemplate.statuses.length > 0 && (
              <div>
                <span className="block text-xs text-zinc-400 mb-1.5 font-medium">Statuses</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.statuses.map((status) => (
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
              </div>
            )}

            {/* Topic preview pills (template only) */}
            {selectedTemplate && selectedTemplate.topics.length > 0 && (
              <div>
                <span className="block text-xs text-zinc-400 mb-1.5 font-medium">Topics</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplate.topics.map((topic) => (
                    <span
                      key={topic.id}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: topic.color
                          ? `${topic.color}33`
                          : 'rgba(113, 113, 122, 0.2)',
                        color: topic.color ?? '#a1a1aa',
                      }}
                    >
                      {topic.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Starter tasks count (template only) */}
            {selectedTemplate && selectedTemplate.tasks.length > 0 && (
              <p className="text-xs text-zinc-500">
                {selectedTemplate.tasks.length} starter{' '}
                {selectedTemplate.tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            )}

            {/* Error */}
            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Footer */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || submitting}
                className="bg-zinc-100 text-zinc-900 text-sm font-semibold rounded-lg px-5 py-2 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                )}
                Create
              </button>
              <button
                onClick={onClose}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
