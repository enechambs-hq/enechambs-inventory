import Link from 'next/link';
import { redirect } from 'next/navigation';
import ComboCard from '@/components/storefront/ComboCard';
import SafeImage from '@/components/storefront/SafeImage';
import { isStorefrontEnabled } from '@/lib/server/flags';
import { formatNaira, HOME_FEATURED_COUNT } from '@/lib/storefront/catalogue';
import { getComboList } from '@/lib/storefront/catalogue.server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Flag off: exactly the previous behaviour of "/" (straight to the staff login).
  if (!isStorefrontEnabled()) redirect('/login');

  // Real published combos only. If the catalogue cannot be read or is empty the
  // photo and the featured section are simply omitted.
  const result = await getComboList({ page: 1, limit: HOME_FEATURED_COUNT });
  const combos = result.ok ? result.data.data : [];
  const heroCombo = combos.find((c) => c.images.length > 0);

  return (
    <>
      <section className="bg-gradient-to-br from-[#0f5a33] to-[#0b3d22] text-white">
        <div className="mx-auto grid max-w-[80rem] items-center gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 md:gap-12 md:py-12 lg:px-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Year-End <span className="text-[#f4b942]">Combos</span>
            </h1>
            <p className="mt-3 max-w-md text-base text-white/85 md:mt-4">
              Food combos from Enechambs, ordered online for delivery or pickup.
            </p>
            <Link
              href="/combos"
              className="mt-6 inline-flex items-center rounded-full bg-[#f4b942] px-7 py-3 text-base font-semibold text-[#0b3d22] transition-colors hover:bg-[#ffc95c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Shop Combos
            </Link>
          </div>
          {heroCombo && (
            <Link
              href={`/combos/${heroCombo.slug}`}
              className="group relative hidden aspect-[16/10] w-full max-w-md justify-self-end overflow-hidden rounded-2xl bg-[#0b3d22] md:block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <SafeImage src={heroCombo.images[0].url} alt={heroCombo.images[0].altText || heroCombo.name} priority className="h-full w-full" />
              <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-white">
                <span className="text-base font-semibold">{heroCombo.name}</span>
                <span className="font-bold text-[#f4b942]">{formatNaira(heroCombo.price)}</span>
              </span>
            </Link>
          )}
        </div>
      </section>

      {combos.length > 0 && (
        <section className="mx-auto max-w-[80rem] px-4 py-10 sm:px-6 md:py-12 lg:px-8" aria-labelledby="featured-heading">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 id="featured-heading" className="text-xl font-bold sm:text-2xl tracking-tight text-[#0f4f2d]">
              Featured combos
            </h2>
            <Link href="/combos" className="shrink-0 text-sm font-semibold text-[#1a7a4a] sm:text-base underline-offset-4 hover:underline">
              View all combos
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {combos.map((combo) => (
              <ComboCard key={combo.slug} combo={combo} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
