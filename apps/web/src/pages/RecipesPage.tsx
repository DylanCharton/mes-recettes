import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function RecipesPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <section>
      <h1 className="text-2xl font-semibold">Recettes</h1>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        {health.isPending && 'Connexion à l’API…'}
        {health.isError && 'API injoignable'}
        {health.isSuccess && `API OK (v${health.data.version})`}
      </p>
    </section>
  );
}
