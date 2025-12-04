import { getScoreColor, getScoreLabel } from '../utils/helpers';

function ScoreBadge({ score, showLabel = true, size = 'default' }) {
  const colorClass = getScoreColor(score);
  const label = getScoreLabel(score);

  const sizeClasses = {
    small: 'text-xs px-2 py-0.5',
    default: 'text-sm px-2 py-1',
    large: 'text-base px-3 py-1.5'
  };

  return (
    <div 
      className={`score-badge inline-flex items-center gap-1 font-bold text-white ${colorClass} ${sizeClasses[size]}`}
      title={`Score: ${score}/100`}
    >
      <span>{score}</span>
      {showLabel && size !== 'small' && (
        <span className="text-xs font-normal opacity-90">/100</span>
      )}
    </div>
  );
}

export default ScoreBadge;
