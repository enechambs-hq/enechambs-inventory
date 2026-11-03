export const formatNaira = (n: number): string => `₦${Number(n).toLocaleString('en-NG')}`;

export const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  unpublished: 'Unpublished',
} as const;

export const formatBytes = (n: number): string =>
  n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
