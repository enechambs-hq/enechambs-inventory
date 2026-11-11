import AccessGate from '@/components/auth/AccessGate';

/** Administrators only. The gate keeps the page (and its data requests) from mounting until access is known. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccessGate message="This page is available to administrators only.">{children}</AccessGate>;
}
