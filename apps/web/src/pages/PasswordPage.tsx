import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PASSWORD_MIN_LENGTH } from '@mes-recettes/shared';
import { useChangePassword } from '../api/auth';
import { errorMessage } from '../api/client';
import { BackLink } from '../components/BackLink';
import { inputClass, labelClass, primaryButtonClass } from '../components/ui';

export function PasswordPage() {
  const change = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
        },
      },
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <BackLink to="/settings" />
        <h1 className="text-2xl font-semibold">Mot de passe</h1>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="current-password" className={labelClass}>
            Mot de passe actuel
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="new-password" className={labelClass}>
            Nouveau mot de passe ({PASSWORD_MIN_LENGTH} caractères minimum)
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {change.isError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errorMessage(change.error)}
          </p>
        )}
        {change.isSuccess && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            Mot de passe changé. Tes autres appareils devront se reconnecter.
          </p>
        )}
        <button type="submit" className={primaryButtonClass} disabled={change.isPending}>
          {change.isPending && <Loader2 size={18} className="animate-spin" aria-hidden />}
          Changer le mot de passe
        </button>
      </form>
    </section>
  );
}
