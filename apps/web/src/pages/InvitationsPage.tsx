import { Check, Copy, Loader2, Share2, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { CreatedInvitation } from '@mes-recettes/shared';
import {
  invitationUrl,
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
} from '../api/auth';
import { errorMessage } from '../api/client';
import { BackLink } from '../components/BackLink';
import { LoadError, Loading } from '../components/QueryStatus';
import { iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../components/ui';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** Invitations (administrateur) : un lien à usage unique, valable 7 jours, par personne. */
export function InvitationsPage() {
  const invitations = useInvitations();
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const [created, setCreated] = useState<CreatedInvitation | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <BackLink to="/settings" />
        <h1 className="text-2xl font-semibold">Inviter quelqu’un</h1>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        La personne invitée crée son compte et démarre avec une bibliothèque vide : elle ne voit pas
        tes recettes, tu ne vois pas les siennes.
      </p>

      <button
        type="button"
        className={primaryButtonClass}
        disabled={create.isPending}
        onClick={() => create.mutate(undefined, { onSuccess: setCreated })}
      >
        {create.isPending ? (
          <Loader2 size={18} className="animate-spin" aria-hidden />
        ) : (
          <UserPlus size={18} aria-hidden />
        )}
        Créer un lien d’invitation
      </button>
      {create.isError && <p className="text-sm text-red-600">{errorMessage(create.error)}</p>}

      {created && <CreatedLink invitation={created} />}

      <h2 className="mt-2 font-medium">Invitations en attente</h2>
      {invitations.isPending && <Loading />}
      {invitations.isError && (
        <LoadError error={invitations.error} onRetry={() => invitations.refetch()} />
      )}
      {invitations.isSuccess && invitations.data.length === 0 && (
        <p className="text-sm text-zinc-500">Aucune.</p>
      )}
      {invitations.isSuccess && invitations.data.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {invitations.data.map((invitation) => (
            <li key={invitation.id} className="flex min-h-14 items-center gap-3">
              <span className="flex-1 text-sm">
                Créée le {dateFormat.format(new Date(invitation.createdAt))}, valable jusqu’au{' '}
                {dateFormat.format(new Date(invitation.expiresAt))}
              </span>
              <button
                type="button"
                className={iconButtonClass}
                aria-label="Annuler l’invitation"
                disabled={revoke.isPending}
                onClick={() =>
                  revoke.mutate(invitation.id, {
                    onSuccess: () => {
                      if (created?.id === invitation.id) setCreated(null);
                    },
                  })
                }
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Le lien n'est affiché qu'une fois : il faut le transmettre maintenant. */
function CreatedLink({ invitation }: { invitation: CreatedInvitation }) {
  const url = invitationUrl(invitation.token);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
      <p className="text-sm">
        Envoie ce lien à la personne invitée. Il ne sera plus affiché ensuite et ne sert qu’une
        fois.
      </p>
      <code className="break-all rounded-lg bg-white p-2 text-sm dark:bg-zinc-900">{url}</code>
      <div className="flex gap-2">
        {canShare && (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() =>
              navigator
                .share({ title: 'Mes recettes', text: 'Crée ton compte :', url })
                .catch(() => {
                  // Partage annulé : rien à faire.
                })
            }
          >
            <Share2 size={18} aria-hidden /> Partager
          </button>
        )}
        <button type="button" className={secondaryButtonClass} onClick={copy}>
          {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  );
}
