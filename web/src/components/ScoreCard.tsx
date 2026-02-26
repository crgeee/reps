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
      <p className="text-xs text-zinc-500 mb-1 truncate">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{score}</p>
      <p className="text-xs text-zinc-600">/{max}</p>
    </div>
  );
}
