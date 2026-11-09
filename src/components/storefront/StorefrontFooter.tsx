import Link from 'next/link';
import BrandMark from './BrandMark';

/**
 * Business contact details are not published yet. Each slot below is reserved
 * and shows a placeholder until the official value is supplied: set the
 * constant to the real string and it appears (email and phone become links).
 */
const CONTACT = {
  email: null as string | null,
  phone: null as string | null,
  address: null as string | null,
};

const link = 'rounded text-[#5d5645] hover:text-[#0f4f2d] hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const heading = 'text-sm font-semibold uppercase tracking-wide text-[#0f4f2d]';

function Detail({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div>
      <dt className="text-sm text-[#8b7f6b]">{label}</dt>
      <dd className="text-base text-[#1d2a22]">
        {value ? (href ? <a href={href} className={link}>{value}</a> : value) : <span className="text-[#8b7f6b]">To be announced</span>}
      </dd>
    </div>
  );
}

export default function StorefrontFooter() {
  return (
    <footer className="border-t border-[#eadfc8] bg-[#f4ecd9]">
      <div className="mx-auto grid max-w-[80rem] gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size={32} />
            <p className="text-base font-semibold text-[#0f4f2d]">Enechambs Food</p>
          </div>
          <p className="mt-3 max-w-xs text-base text-[#5d5645]">Food combos, ordered online for delivery or pickup.</p>
        </div>
        <nav aria-label="Footer">
          <h2 className={heading}>Shop</h2>
          <ul className="mt-3 space-y-2 text-base">
            <li><Link href="/combos" className={link}>Combos</Link></li>
            <li><Link href="/cart" className={link}>Cart</Link></li>
            <li><Link href="/my-orders" className={link}>My orders</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className={heading}>Contact</h2>
          <dl className="mt-3 space-y-3">
            <Detail label="Email" value={CONTACT.email} href={CONTACT.email ? `mailto:${CONTACT.email}` : undefined} />
            <Detail label="Phone" value={CONTACT.phone} href={CONTACT.phone ? `tel:${CONTACT.phone.replace(/\s/g, '')}` : undefined} />
            <Detail label="Address" value={CONTACT.address} />
          </dl>
        </div>
      </div>
      <div className="border-t border-[#eadfc8]">
        <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-[#8b7f6b] sm:px-6 lg:px-8">
          <span>&copy; {new Date().getFullYear()} Enechambs Food</span>
          <Link href="/login" className={link}>Staff sign in</Link>
        </div>
      </div>
    </footer>
  );
}
