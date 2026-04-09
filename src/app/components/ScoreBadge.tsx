interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className={`w-1.5 h-1.5 border border-[#EAEAEA] ${
            index <= score ? 'bg-[#1A2A44]' : 'bg-white'
          }`}
        />
      ))}
    </div>
  );
}
