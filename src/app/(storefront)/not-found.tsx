import Link from 'next/link';

/** Shown for an unknown or unavailable combo (and for the storefront when it is switched off). */
export default function StorefrontNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-[#8b7f6b]">404</p>
      <h1 className="mt-2 text-2xl font-bold text-[#0f4f2d]">We could not find that page</h1>
      <p className="mt-2 text-sm text-[#5d5645]">The combo may have been removed or is not available right now.</p>
      <Link
        href="/combos"
        className="mt-6 inline-flex rounded-full bg-[#1a7a4a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#145c37]"
      >
        See all combos
      </Link>
    </div>
  );
}
