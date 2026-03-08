import { PROVIDER_OPTIONS, type AiProvider } from '../ai-config';

interface Props {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
}

export default function ProviderPicker({ value, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PROVIDER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`p-3 rounded-lg border text-left transition-colors ${
            value === opt.value
              ? 'border-zinc-500 bg-zinc-800'
              : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
          }`}
        >
          <p className="text-sm font-medium text-zinc-200">{opt.label}</p>
          <p className="text-xs text-zinc-500">{opt.models[0].label}</p>
        </button>
      ))}
    </div>
  );
}
