import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { logger } from '../logger';
import type { CollectionTemplate, Collection } from '../types';
import { COLOR_SWATCHES } from '../types';
import { getTemplates, createCollection, createCollectionFromTemplate } from '../api';
import TemplateCard from './TemplateCard';
import { errorMessage, pillStyle, ICON_OPTIONS } from '../utils/ui';

interface CreateCollectionModalProps {
  onCreated: (collection: Collection) => void;
  onClose: () => void;
}

export default function CreateCollectionModal({ onCreated, onClose }: CreateCollectionModalProps) {
  const [step, setStep] = useState<'pick' | 'customize'>('pick');
  const [templates, setTemplates] = useState<CollectionTemplate[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CollectionTemplate | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
  const [srEnabled, setSrEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates
  const cancelRef = useRef<(() => void) | null>(null);

  const fetchTemplates = useCallback(() => {
    cancelRef.current?.();
    setTemplates(null);
    setFetchError(null);
    let cancelled = false;
    getTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((err) => {
        logger.error('Failed to fetch templates', { error: String(err) });
        if (!cancelled) setFetchError('Failed to load templates');
      });
    cancelRef.current = () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchTemplates();
    return () => {
      cancelRef.current?.();
    };
  }, [fetchTemplates]);

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
      logger.error('Failed to create collection', { error: String(err) });
      setError(errorMessage(err, 'Failed to create collection'));
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
        className="anim-modal-enter bg-zinc-900 border border-zinc-700 rounded-t-xl sm:rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4"
      >
        {step === 'pick' ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">New Collection</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template loading / error / list */}
            {fetchError ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-red-400">{fetchError}</p>
                <button
                  onClick={fetchTemplates}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            ) : templates === null ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 animate-pulse"
                  >
                    <div className="h-4 bg-zinc-700/50 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-zinc-700/30 rounded w-full mb-1.5" />
                    <div className="h-3 bg-zinc-700/30 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {userTemplates.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                      My Templates
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
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
                    <h3 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                      Templates
                    </h3>
                  )}
                  <div className="grid grid-cols-2 gap-2">
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
                      className="border-2 border-dashed border-zinc-700 rounded-xl p-4 hover:border-zinc-500 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-zinc-400 hover:text-zinc-200 min-h-[80px]"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-medium">Blank</span>
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
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={handleBack}
                  aria-label="Back"
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-semibold text-zinc-100 truncate">
                  {selectedTemplate ? `From: ${selectedTemplate.name}` : 'New collection'}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                placeholder="Collection name"
                autoFocus
              />
            </div>

            {/* Icon picker (only for blank collections — templates define their own icon) */}
            {!selectedTemplate && (
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">
                  Icon
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setIcon(ic)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                        icon === ic
                          ? 'bg-zinc-700 ring-2 ring-zinc-500 ring-offset-1 ring-offset-zinc-900'
                          : 'bg-zinc-800 hover:bg-zinc-750 border border-zinc-700'
                      }`}
                    >
                      {ic || <span className="text-zinc-500 text-[10px]">-</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color swatches */}
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">
                Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-all duration-150 ${
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
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
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
                <span className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">
                  Statuses
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.statuses.map((status) => (
                    <span
                      key={status.id}
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={pillStyle(status.color)}
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
                <span className="block text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">
                  Topics
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.topics.map((topic) => (
                    <span
                      key={topic.id}
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={pillStyle(topic.color)}
                    >
                      {topic.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Starter tasks count (template only) */}
            {selectedTemplate && selectedTemplate.tasks.length > 0 && (
              <p className="text-[10px] text-zinc-500">
                {selectedTemplate.tasks.length} starter{' '}
                {selectedTemplate.tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            )}

            {/* Error */}
            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* Footer */}
            <div className="flex items-center gap-3 pt-1">
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
