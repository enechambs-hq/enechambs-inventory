import { STATUS_LABELS } from '@/lib/combos/format';
import type { ComboStatus } from '@/types/combos';

const STYLES: Record<ComboStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  published: 'bg-[#e8f5ee] text-[#1a7a4a] border-[#b9e0c9]',
  unpublished: 'bg-amber-50 text-amber-700 border-amber-200',
};

const DOTS: Record<ComboStatus, string> = {
  draft: 'bg-gray-400',
  published: 'bg-[#1a7a4a]',
  unpublished: 'bg-amber-500',
};

export default function ComboStatusBadge({ status }: { status: ComboStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-sm font-medium ${STYLES[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
