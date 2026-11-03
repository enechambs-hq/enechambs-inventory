import Link from 'next/link';
import BrandMark from './BrandMark';

export default function StorefrontFooter() {
  return (
    <footer className="border-t border-[#eadfc8] bg-[#f4ecd9]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark size={28} />
          <p className="text-sm font-semibold text-[#0f4f2d]">Enechambs Food</p>
        </div>
        <div className="flex items-center gap-5 text-sm text-[#5d5645]">
          <span>&copy; {new Date().getFullYear()} Enechambs Food</span>
          {/* Staff keep a way in now that "/" is the storefront. */}
          <Link href="/login" className="underline-offset-4 hover:text-[#1a7a4a] hover:underline">
            Staff sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
