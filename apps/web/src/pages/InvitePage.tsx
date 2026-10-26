import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PASSWORD_MIN_LENGTH } from '@mes-recettes/shared';
import { useAcceptInvitation, useInvitationCheck } from '../api/auth';
import { errorMessage } from '../api/client';
import { Loading } from '../components/QueryStatus';
import { inputClass, labelClass, primaryButtonClass } from '../components/ui';

/** Création d'un compte depuis un lien d'invitation (route publique, hors barre de navigation). */
export function InvitePage() {
  const { token = '' } = useParams();
  const invitation = useInvitationCheck(token);
  const accept = useAcceptInvitation(token);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: e.target.value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    accept.mutate(form, { onSuccess: () => navigate('/recipes', { replace: true }) });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/icons/icon-192.png" alt="" className="size-16" />
        <h1 className="text-2xl font-semibold">Mes recettes</h1>
      </div>

      {invitation.isPending && <Loading />}

      {invitation.isError && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-zinc-600 dark:text-zinc-300">{errorMessage(invitation.error)}</p>
          <Link to="/login" className="text-accent underline">
            J’ai déjà un compte
          </Link>
        </div>
      )}

      {invitation.isSuccess && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-center text-zinc-600 dark:text-zinc-300">
            {invitation.data.invitedBy} t’invite à créer ta propre bibliothèque de recettes.
          </p>
          <div>
            <label htmlFor="name" className={labelClass}>
              Prénom
            </label>
            <input
              id="name"
              autoComplete="given-name"
              required
              maxLength={60}
              value={form.name}
              onChange={set('name')}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              E-mail (pour te connecter)
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={set('email')}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Mot de passe ({PASSWORD_MIN_LENGTH} caractères minimum)
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={form.password}
              onChange={set('password')}
              className={inputClass}
            />
          </div>
          {accept.isError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {errorMessage(accept.error)}
            </p>
          )}
          <button type="submit" className={primaryButtonClass} disabled={accept.isPending}>
            {accept.isPending && <Loader2 size={18} className="animate-spin" aria-hidden />}
            Créer mon compte
          </button>
        </form>
      )}
    </main>
  );
}
