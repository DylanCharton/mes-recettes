import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { extractUrl } from '@mes-recettes/shared';
import { Loading } from '../components/QueryStatus';

/**
 * Cible de partage Android (manifest `share_target`, spec § 20.2). Les applications placent le
 * lien tantôt dans `url`, tantôt dans `text` (« Découvre cette recette… https://… »), voire `title`.
 */
export function SharePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const url = ['url', 'text', 'title']
    .map((key) => extractUrl(params.get(key) ?? ''))
    .find((value) => value !== null);

  useEffect(() => {
    if (!url) return;
    // Remplace l'entrée d'historique : « retour » ne relance pas l'import.
    navigate(`/import?${new URLSearchParams({ url, auto: '1' })}`, { replace: true });
  }, [url, navigate]);

  if (!url) {
    return (
      <Navigate
        to="/import"
        replace
        state={{ shareError: 'Aucun lien trouvé dans le contenu partagé.' }}
      />
    );
  }
  return <Loading />;
}
