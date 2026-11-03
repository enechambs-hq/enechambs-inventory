import Link from 'next/link';
import BrandMark from './BrandMark';

export default function StorefrontHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#eadfc8] bg-[#fbf7ef]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1a7a4a]">
          <BrandMark size={36} />
          <span className="leading-none">
            <span className="block text-base font-bold tracking-tight text-[#0f4f2d]">Enechambs</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[#8b7f6b]">Food</span>
          </span>
        </Link>
        <nav aria-label="Main">
          <Link
            href="/combos"
            className="rounded-full px-4 py-2 text-sm font-semibold text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]"
          >
            Year-End Combos
          </Link>
        </nav>
      </div>
    </header>
  );
}
