import type { Metadata } from 'next';
import StorefrontFooter from '@/components/storefront/StorefrontFooter';
import StorefrontHeader from '@/components/storefront/StorefrontHeader';

/**
 * Public storefront shell. Server components only: no staff AuthProvider, no
 * staff store, no axios client. Pages in this group check the feature flag
 * themselves (a layout is not a safe place to gate, see Next.js docs).
 */
export const metadata: Metadata = {
  title: { default: 'Enechambs Food', template: '%s | Enechambs Food' },
  description: 'Year-End Combos from Enechambs Food.',
};

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#fbf7ef] text-[#1d2a22]">
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </div>
  );
}
