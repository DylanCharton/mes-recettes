import { ChevronRight, Tags } from 'lucide-react';
import { Link } from 'react-router';

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Réglages</h1>
      <ul className="divide-y divide-zinc-100 rounded-xl bg-zinc-50 dark:divide-zinc-800 dark:bg-zinc-800/60">
        <li>
          <Link to="/tags" className="flex min-h-14 items-center gap-3 px-4">
            <Tags size={20} aria-hidden />
            <span className="flex-1">Gérer les tags</span>
            <ChevronRight size={18} className="text-zinc-400" aria-hidden />
          </Link>
        </li>
      </ul>
    </section>
  );
}
