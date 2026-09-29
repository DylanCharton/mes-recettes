import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    mutationFn: async (password: string) =>
      unwrap(await api.auth.login.$post({ json: { password } })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.auth.logout.$post()),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign('/login');
    },
  });
}

/** Chemin interne sûr pour le retour après connexion (pas de redirection ouverte). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/recipes';
}

/** Session expirée ou absente : direction la connexion, en gardant la page (et l'import) en cours. */
export function redirectToLogin() {
  const { pathname, search } = window.location;
  if (pathname === '/login') return;
  window.location.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
}
