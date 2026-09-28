import { Flower2, Leaf, Snowflake, Sun, type LucideIcon } from 'lucide-react';
import { SEASON_LABELS, SEASONS, type Season } from '@mes-recettes/shared';
import { toggle } from '../lib/filters';
import { Chip } from './Chip';

export const SEASON_ICONS: Record<Season, LucideIcon> = {
  spring: Flower2,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
};

type Props = {
  value: Season[];
  onChange: (seasons: Season[]) => void;
  /** Saisons suggérées par l'import, affichées en pointillés tant qu'elles ne sont pas cochées. */
  suggested?: Season[];
  /** Raccourci « Toute l'année » (formulaire) ; masqué dans les filtres. */
  allYear?: boolean;
};

export function SeasonPicker({ value, onChange, suggested = [], allYear = true }: Props) {
  const everySeason = value.length === SEASONS.length;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Saisons">
      {SEASONS.map((season) => {
        const Icon = SEASON_ICONS[season];
        return (
          <Chip
            key={season}
            active={value.includes(season)}
            suggested={suggested.includes(season)}
            onClick={() => onChange(toggle(value, season))}
          >
            <Icon size={16} aria-hidden />
            {SEASON_LABELS[season]}
          </Chip>
        );
      })}
      {allYear && (
        <Chip active={everySeason} onClick={() => onChange(everySeason ? [] : [...SEASONS])}>
          Toute l’année
        </Chip>
      )}
    </div>
  );
}
