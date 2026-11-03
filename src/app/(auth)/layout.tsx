import AuthProvider from '@/components/providers/AuthProvider';

/** Staff login and password setup need the staff AuthProvider (moved here from the root layout). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
