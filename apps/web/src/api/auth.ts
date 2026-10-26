import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatedInvitation, Invitation } from '@mes-recettes/shared';
import { api, unwrap } from './client';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => unwrap(await api.auth.me.$get()),
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) =>
      unwrap(await api.auth.login.$post({ json: credentials })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/**
 * Caches du service worker remplis par le compte connecté (fiches et images, voir
 * vite.config.ts) : vidés à la déconnexion pour ne rien laisser au compte suivant.
 */
const ACCOUNT_CACHES = ['recipes', 'images'];

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await unwrap(await api.auth.logout.$post());
      if ('caches' in window) await Promise.all(ACCOUNT_CACHES.map((name) => caches.delete(name)));
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.assign('/login');
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) =>
      unwrap(await api.auth.password.$post({ json: input })),
  });
}

export function useInvitationCheck(token: string) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => unwrap(await api.auth.invitations[':token'].$get({ param: { token } })),
    retry: false,
  });
}

export function useAcceptInvitation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) =>
      unwrap(await api.auth.invitations[':token'].accept.$post({ param: { token }, json: input })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useInvitations() {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: async (): Promise<Invitation[]> => unwrap(await api.invitations.$get()),
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<CreatedInvitation> => unwrap(await api.invitations.$post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(await api.invitations[':id'].$delete({ param: { id: String(id) } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });
}

/** Lien d'invitation à transmettre (le jeton n'est connu qu'à la création). */
export const invitationUrl = (token: string) => `${window.location.origin}/invite/${token}`;

/** Chemin interne sûr pour le retour après connexion (pas de redirection ouverte). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/recipes';
}

/** Session expirée ou absente : direction la connexion, en gardant la page (et l'import) en cours. */
export function redirectToLogin() {
  const { pathname, search } = window.location;
  if (pathname === '/login' || pathname.startsWith('/invite/')) return;
  window.location.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
}
