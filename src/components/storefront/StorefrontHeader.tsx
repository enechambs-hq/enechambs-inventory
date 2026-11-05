import Link from 'next/link';
import BrandMark from './BrandMark';
import HeaderActions from './HeaderActions';

export default function StorefrontHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#eadfc8] bg-[#fbf7ef]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Enechambs Food home" className="flex shrink-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1a7a4a] sm:gap-3">
          <BrandMark size={36} />
          <span className="hidden leading-none sm:inline">
            <span className="block text-base font-bold tracking-tight text-[#0f4f2d]">Enechambs</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[#8b7f6b]">Food</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/combos"
            className="hidden whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-semibold text-[#0f4f2d] transition hover:bg-[#e8f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a] min-[400px]:inline-block sm:px-4"
          >
            <span className="hidden sm:inline">Year-End </span>Combos
          </Link>
          <HeaderActions />
        </nav>
      </div>
    </header>
  );
}
