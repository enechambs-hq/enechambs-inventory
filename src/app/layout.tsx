import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Enechambs Inventory',
  description: 'Enechambs Food inventory management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans" suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}