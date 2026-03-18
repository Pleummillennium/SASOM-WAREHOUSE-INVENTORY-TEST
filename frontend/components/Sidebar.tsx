'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/search', label: 'Search', icon: '⌕' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 text-zinc-100 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-zinc-700">
        <p className="text-xs text-zinc-400 uppercase tracking-widest">SASOM</p>
        <h1 className="text-base font-semibold mt-0.5">Warehouse</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-zinc-700 text-white font-medium'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-zinc-700 text-xs text-zinc-500">
        Inventory v1.0
      </div>
    </aside>
  );
}
