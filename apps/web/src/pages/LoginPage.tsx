import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { safeNextPath, useLogin } from '../api/auth';
import { errorMessage } from '../api/client';
import { inputClass, primaryButtonClass } from '../components/ui';

export function LoginPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate(password, {
      // Reprend là où on en était (ex. un import lancé depuis le partage Android).
      onSuccess: () => navigate(safeNextPath(params.get('next')), { replace: true }),
      onError: () => setPassword(''),
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/icons/icon-192.png" alt="" className="size-16" />
        <h1 className="text-2xl font-semibold">Mes recettes</h1>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="password" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {login.isError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errorMessage(login.error)}
          </p>
        )}
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={login.isPending || !password}
        >
          {login.isPending && <Loader2 size={18} className="animate-spin" aria-hidden />}
          Se connecter
        </button>
      </form>
    </main>
  );
}
