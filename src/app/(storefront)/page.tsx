import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import ComboCard from '@/components/storefront/ComboCard';
import HeroVisual from '@/components/storefront/HeroVisual';
import { isStorefrontEnabled } from '@/lib/server/flags';
import { HOME_FEATURED_COUNT } from '@/lib/storefront/catalogue';
import { getComboList } from '@/lib/storefront/catalogue.server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Flag off: exactly the previous behaviour of "/" (straight to the staff login).
  if (!isStorefrontEnabled()) redirect('/login');

  // The hero and the preview use real published combos only. If the catalogue
  // cannot be read or is empty the preview is simply omitted.
  const result = await getComboList({ page: 1, limit: HOME_FEATURED_COUNT });
  const combos = result.ok ? result.data.data : [];

  return (
    <>
      <section className="relative isolate overflow-clip bg-[radial-gradient(120%_90%_at_80%_0%,#1f8a52_0%,#0f5a33_45%,#082c19_100%)] text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:26px_26px]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#ffe9a8] ring-1 ring-inset ring-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f4b942]" aria-hidden="true" />
              Seasonal campaign
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Year-End <span className="text-[#f4b942]">Combos</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
              Browse this season&apos;s Enechambs Food combos, see what is still available and pick your favourites.
            </p>
            <div className="mt-8">
              <Link
                href="/combos"
                className="group inline-flex items-center gap-2 rounded-full bg-[#f4b942] px-7 py-3.5 text-base font-bold text-[#0b3d22] shadow-[0_14px_30px_-10px_rgba(244,185,66,0.8)] transition hover:-translate-y-0.5 hover:bg-[#ffc95c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Shop Now
                <ArrowRight size={18} className="transition group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="pt-4"><HeroVisual combos={combos} /></div>
        </div>
      </section>

      {combos.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="featured-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="featured-heading" className="text-2xl font-bold tracking-tight text-[#0f4f2d]">
              Featured combos
            </h2>
            <Link href="/combos" className="text-sm font-semibold text-[#1a7a4a] underline-offset-4 hover:underline">
              View all combos
            </Link>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {combos.map((combo) => (
              <ComboCard key={combo.slug} combo={combo} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
