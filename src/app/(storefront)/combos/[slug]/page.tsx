import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AvailabilityBadge from '@/components/storefront/AvailabilityBadge';
import ComboContents from '@/components/storefront/ComboContents';
import Price from '@/components/storefront/Price';
import SafeImage from '@/components/storefront/SafeImage';
import { LoadError } from '@/components/storefront/StatePanels';
import { isStorefrontEnabled } from '@/lib/server/flags';
import { formatNaira, isSoldOut, isValidSlug, savingOf } from '@/lib/storefront/catalogue';
import { getComboBySlug } from '@/lib/storefront/catalogue.server';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  if (!isStorefrontEnabled() || !isValidSlug(slug)) return {};
  const result = await getComboBySlug(slug);
  if (!result.ok) return {};
  return {
    title: result.data.name,
    description: result.data.description ? result.data.description.slice(0, 160) : undefined,
  };
}

export default async function ComboPage({ params }: { params: Params }) {
  if (!isStorefrontEnabled()) notFound();
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const result = await getComboBySlug(slug);
  if (!result.ok) {
    if (result.kind === 'not_found') notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <LoadError kind={result.kind} retryHref={`/combos/${slug}`} />
      </div>
    );
  }

  const combo = result.data;
  const [main, ...rest] = combo.images;
  const saving = savingOf(combo);
  const soldOut = isSoldOut(combo);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/combos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#1a7a4a] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All combos
      </Link>

      <article className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-[#eadfc8] bg-[#f6efe0] shadow-[0_24px_40px_-24px_rgba(60,40,0,0.45)]">
            <SafeImage
              src={main?.url}
              alt={main?.altText || combo.name}
              priority
              className={`h-full w-full ${soldOut ? 'grayscale-[0.6] opacity-80' : ''}`}
            />
            {soldOut && (
              <span className="absolute left-4 top-4 rounded-full bg-[#2b2b28]/85 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                Sold Out
              </span>
            )}
          </div>
          {rest.length > 0 && (
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {rest.map((image) => (
                <li key={image.url} className="aspect-square overflow-hidden rounded-2xl border border-[#eadfc8] bg-[#f6efe0]">
                  <SafeImage src={image.url} alt={image.altText || combo.name} className="h-full w-full" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-[#0f4f2d] sm:text-4xl">{combo.name}</h1>
          <div className="mt-4">
            <Price price={combo.price} referencePrice={combo.referencePrice} size="lg" />
            {saving !== null && (
              <p className="mt-1 text-sm font-medium text-[#14693f]">You save {formatNaira(saving)}</p>
            )}
          </div>
          <div className="mt-5">
            <AvailabilityBadge availability={combo.availability} />
            {soldOut && (
              <p className="mt-3 text-sm text-[#5d5645]">This combo is sold out at the moment. Have a look at the other combos.</p>
            )}
          </div>
          <ComboContents items={combo.items} />
          {combo.description && (
            <div className="mt-7 border-t border-[#eadfc8] pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8b7f6b]">About this combo</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-[#3b3a33]">{combo.description}</p>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
