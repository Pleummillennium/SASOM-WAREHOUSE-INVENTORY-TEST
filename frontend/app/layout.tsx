import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import QueryProvider from '@/components/providers/QueryProvider';
import Sidebar from '@/components/Sidebar';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SASOM Warehouse Inventory',
  description: 'Warehouse shelf allocation & monitoring system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased bg-zinc-50 text-zinc-900`}>
        <QueryProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
