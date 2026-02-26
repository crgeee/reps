interface ScoreCardProps {
  label: string;
  score: number;
  max?: number;
}

export default function ScoreCard({ label, score, max = 5 }: ScoreCardProps) {
  const color =
    score >= 4 ? 'text-green-400' : score >= 3 ? 'text-amber-400' : 'text-red-400';
  const bgColor =
    score >= 4
      ? 'bg-green-950/30 border-green-800/40'
      : score >= 3
        ? 'bg-amber-950/30 border-amber-800/40'
        : 'bg-red-950/30 border-red-800/40';

  return (
    <div className={`p-3 rounded-lg border text-center transition-all duration-200 ${bgColor}`}>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 truncate font-medium">{label}</p>
      <p className={`text-3xl font-bold font-mono tabular-nums ${color}`}>{score}</p>
      <p className="text-[10px] text-zinc-600 font-mono">/{max}</p>
    </div>
  );
}
