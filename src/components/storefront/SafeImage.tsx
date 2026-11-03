'use client';

import { useState } from 'react';
import BrandMark from './BrandMark';

/**
 * A combo image with a graceful fallback: a missing URL, or one that fails to
 * load, shows the branded placeholder instead of a broken-image icon. Plain
 * <img> on purpose: the media host is the server-provided public URL and is
 * not known at build time (next/image would need a hard-coded remote pattern).
 */
export default function SafeImage({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <ImagePlaceholder className={className} label={alt} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- server-provided public media URL
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function ImagePlaceholder({ className = '', label }: { className?: string; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label ? `${label} (no photo yet)` : 'No photo yet'}
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#e7f3ec] via-[#f6efe0] to-[#fbe9bd] ${className}`}
    >
      <div className="absolute inset-[12%] rounded-full border border-[#1a7a4a]/15" />
      <div className="absolute inset-[26%] rounded-full border border-[#1a7a4a]/15" />
      <BrandMark size={44} className="relative opacity-80" />
    </div>
  );
}
