import { BookOpen, Download, Settings, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/recipes', label: 'Recettes', icon: BookOpen },
  { to: '/import', label: 'Importer', icon: Download },
  { to: '/settings', label: 'Réglages', icon: Settings },
];

export function Layout() {
  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-5xl px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-900">
        <ul className="mx-auto flex max-w-5xl">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-1 text-xs ${
                    isActive ? 'text-accent' : 'text-zinc-500 dark:text-zinc-400'
                  }`
                }
              >
                <Icon size={22} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
