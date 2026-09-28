import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { iconButtonClass } from './ui';

export function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className={`${iconButtonClass} -ml-3 mb-1`} aria-label="Retour">
      <ArrowLeft size={22} />
    </Link>
  );
}
