import { STATUS_COLORS, STATUS_ICONS } from '../../utils/helpers.js';

export default function StatusBadge({ status, size = 'sm' }) {
  const colors = STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  const icon = STATUS_ICONS[status] || '○';
  const sizeClass = size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${colors} ${sizeClass}`}
    >
      <span>{icon}</span>
      {status}
    </span>
  );
}
