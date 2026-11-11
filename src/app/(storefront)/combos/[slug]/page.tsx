import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AddToCartButton from '@/components/storefront/AddToCartButton';
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
      <div className="mx-auto max-w-[80rem] px-4 py-10 sm:px-6 lg:px-8">
        <LoadError kind={result.kind} status={result.status} retryHref={`/combos/${slug}`} />
      </div>
    );
  }

  const combo = result.data;
  const [main, ...rest] = combo.images;
  const saving = savingOf(combo);
  const soldOut = isSoldOut(combo);
  const lowStock = combo.availability.status === 'low_stock';

  return (
    <div className="mx-auto max-w-[80rem] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <Link
        href="/combos"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#1a7a4a] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All combos
      </Link>

      <article className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#eadfc8] bg-[#f6efe0] sm:aspect-[16/10] lg:aspect-[4/3]">
            <SafeImage
              src={main?.url}
              alt={main?.altText || combo.name}
              priority
              className={`h-full w-full ${soldOut ? 'grayscale-[0.6] opacity-80' : ''}`}
            />
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
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#0f4f2d] sm:text-4xl">{combo.name}</h1>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Price price={combo.price} referencePrice={combo.referencePrice} size="lg" />
            {saving !== null && <p className="text-sm font-semibold text-[#14693f]">You save {formatNaira(saving)}</p>}
          </div>
          {lowStock && (
            <div className="mt-3">
              <AvailabilityBadge availability={combo.availability} />
            </div>
          )}
          {soldOut && (
            <p className="mt-4 text-base text-[#5d5645]">This combo is sold out at the moment. Have a look at the other combos.</p>
          )}
          <div className="mt-6">
            <AddToCartButton slug={combo.slug} name={combo.name} soldOut={soldOut} />
          </div>
          <ComboContents items={combo.items} />
          {combo.description && (
            <div className="mt-8 border-t border-[#eadfc8] pt-6">
              <h2 className="text-lg font-semibold text-[#0f4f2d]">About this combo</h2>
              <p className="mt-3 max-w-prose whitespace-pre-line text-base leading-relaxed text-[#3b3a33]">{combo.description}</p>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
