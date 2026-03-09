import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  getAiConfig,
  setAiConfig,
  getProviderConfig,
  PROVIDER_OPTIONS,
  type AiProvider,
  type AiConfig,
} from '../../ai-config';

export default function ModelSwitcher() {
  const [config, setConfig] = useState<AiConfig | null>(getAiConfig);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!config) return null;

  const providerConfig = getProviderConfig(config.provider);
  const currentModel = providerConfig.models.find((m) => m.value === config.model);
  const shortLabel = currentModel?.label ?? config.model ?? providerConfig.models[0].label;

  function switchModel(provider: AiProvider, model: string) {
    const updated: AiConfig = { ...config!, provider, model, storageMode: config!.storageMode };
    if (config!.storageMode !== 'server') {
      updated.apiKey = config!.apiKey;
    }
    setAiConfig(updated);
    setConfig(updated);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-400 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-md transition-colors"
      >
        <span className="truncate max-w-[120px]">{shortLabel}</span>
        <ChevronDown
          className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-50">
          {PROVIDER_OPTIONS.map((provider) => (
            <div key={provider.value}>
              <div className="px-3 py-1.5 text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                {provider.label}
              </div>
              {provider.models.map((model) => {
                const isActive = config.provider === provider.value && config.model === model.value;
                return (
                  <button
                    key={model.value}
                    onClick={() => switchModel(provider.value, model.value)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className="text-xs">{model.label}</span>
                    <span className="text-[10px] text-zinc-600 ml-1.5">{model.description}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
