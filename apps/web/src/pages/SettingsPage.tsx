import { ChevronRight, Download, LogOut, Tags } from 'lucide-react';
import { Link } from 'react-router';
import { useLogout, useSession } from '../api/auth';
import { useInstallPrompt } from '../lib/installPrompt';

const row = 'flex min-h-14 w-full items-center gap-3 px-4 text-left';

export function SettingsPage() {
  const session = useSession();
  const logout = useLogout();
  const install = useInstallPrompt();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Réglages</h1>

      <ul className="divide-y divide-zinc-100 rounded-xl bg-zinc-50 dark:divide-zinc-800 dark:bg-zinc-800/60">
        <li>
          <Link to="/tags" className={row}>
            <Tags size={20} aria-hidden />
            <span className="flex-1">Gérer les tags</span>
            <ChevronRight size={18} className="text-zinc-400" aria-hidden />
          </Link>
        </li>
        {install && (
          <li>
            <button type="button" onClick={install} className={row}>
              <Download size={20} aria-hidden />
              <span className="flex-1">Installer l’application</span>
            </button>
          </li>
        )}
        {session.data?.authEnabled && (
          <li>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className={`${row} text-red-600`}
            >
              <LogOut size={20} aria-hidden />
              <span className="flex-1">Se déconnecter</span>
            </button>
          </li>
        )}
      </ul>

      <section className="text-sm text-zinc-600 dark:text-zinc-300">
        <h2 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">Importer depuis Jow</h2>
        <p>
          Une fois l’application installée (Chrome → menu ⋮ → <em>Installer l’application</em>),
          elle apparaît dans le menu <strong>Partager</strong> de Jow : Partager → Mes recettes →
          Enregistrer.
        </p>
      </section>
    </section>
  );
}
