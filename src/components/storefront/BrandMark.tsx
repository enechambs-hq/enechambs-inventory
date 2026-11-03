import { useId } from 'react';

/** The Enechambs "E" mark, identical to src/app/icon.svg and the admin sidebar logo. */
export default function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId();
  const gradient = `ene-mark-${id.replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#1a9155" />
          <stop offset="1" stopColor="#0b3d22" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill={`url(#${gradient})`} />
      <ellipse cx="20" cy="3.5" rx="13" ry="5" fill="white" fillOpacity="0.07" />
      <rect x="9" y="7" width="3.5" height="27" rx="1.75" fill="white" />
      <path d="M9 7H22C25 7 27 8.6 27 10.5C27 12.4 25 14 22 14H9V7Z" fill="white" />
      <path d="M9 18H18C20.8 18 22.5 19.3 22.5 21C22.5 22.7 20.8 24 18 24H9V18Z" fill="white" />
      <path d="M9 27H22C25 27 27 28.6 27 30.5C27 32.4 25 34 22 34H9V27Z" fill="white" />
      <circle cx="27" cy="10.5" r="2.2" fill="#a3f0c0" fillOpacity="0.9" />
      <circle cx="22.5" cy="21" r="1.8" fill="#a3f0c0" fillOpacity="0.8" />
      <circle cx="27" cy="30.5" r="2.2" fill="#a3f0c0" fillOpacity="0.9" />
    </svg>
  );
}
