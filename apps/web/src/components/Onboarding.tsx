import {
  BookHeart,
  ChevronLeft,
  CookingPot,
  Download,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { primaryButtonClass, secondaryButtonClass } from './ui';

type Step = { icon: LucideIcon; title: string; body: ReactNode };

const STEPS: Step[] = [
  {
    icon: BookHeart,
    title: 'Bienvenue dans votre carnet',
    body: 'Vos recettes, chez vous : texte, quantités et photo sont copiés, même si le site d’origine change. Trois gestes à connaître.',
  },
  {
    icon: Download,
    title: '1. Ajoutez une recette',
    body: (
      <>
        Copiez le lien d’une recette Jow et collez-le dans <strong>Importer</strong>. Sur Android,
        avec l’application installée, partagez-la directement vers <strong>Mes recettes</strong>.
        Vous pouvez aussi l’écrire à la main avec le bouton <strong>+</strong>.
      </>
    ),
  },
  {
    icon: CookingPot,
    title: '2. Cuisinez avec le téléphone',
    body: (
      <>
        Sur la fiche, ajustez les portions puis lancez le <strong>Mode cuisine</strong> : l’écran
        reste allumé et vous cochez les étapes au fil de l’eau.
      </>
    ),
  },
  {
    icon: PartyPopper,
    title: '3. Gardez une trace',
    body: (
      <>
        Une fois le plat servi, touchez <strong>« Je viens de la faire ! »</strong> : il rejoint la
        frise de l’accueil, pour retrouver ce que vous avez cuisiné et quand.
      </>
    ),
  },
];

/**
 * Tutoriel affiché tant que la bibliothèque est vide (la dernière étape mène au premier ajout),
 * et à la demande depuis les réglages (`replay`).
 */
export function Onboarding({ replay = false }: { replay?: boolean }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <section
      aria-roledescription="tutoriel"
      aria-label="Prise en main"
      className="mx-auto mt-6 flex max-w-md flex-col items-center gap-5 rounded-2xl bg-zinc-50 p-6 text-center dark:bg-zinc-800/60"
    >
      <div key={index} className="flex flex-col items-center gap-4 motion-safe:animate-cook-pop">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon size={32} aria-hidden />
        </span>
        <h2 className="text-xl font-semibold">{step.title}</h2>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-300">{step.body}</p>
      </div>

      <div className="flex gap-2" aria-label={`Étape ${index + 1} sur ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Aller à l’étape ${i + 1}`}
            aria-current={i === index ? 'step' : undefined}
            className="flex size-6 items-center justify-center"
          >
            <span
              className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-accent' : 'w-2 bg-zinc-300 dark:bg-zinc-600'}`}
            />
          </button>
        ))}
      </div>

      {isLast && replay ? (
        <div className="flex w-full flex-col gap-2">
          <Link to="/recipes" className={primaryButtonClass}>
            C’est noté, à mes recettes
          </Link>
          <button type="button" className={secondaryButtonClass} onClick={() => setIndex(0)}>
            Revoir depuis le début
          </button>
        </div>
      ) : isLast ? (
        <div className="flex w-full flex-col gap-2">
          <Link to="/import" className={primaryButtonClass}>
            <Download size={18} aria-hidden /> Importer ma première recette
          </Link>
          <Link to="/recipes/new" className={secondaryButtonClass}>
            L’écrire à la main
          </Link>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-2">
          {index > 0 ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 px-2 text-zinc-500 dark:text-zinc-400"
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft size={18} aria-hidden /> Retour
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 px-2 text-zinc-500 dark:text-zinc-400"
              onClick={() => setIndex(STEPS.length - 1)}
            >
              Passer
            </button>
          )}
          <button type="button" className={primaryButtonClass} onClick={() => setIndex(index + 1)}>
            {index === 0 ? 'C’est parti' : 'Suivant'}
          </button>
        </div>
      )}
    </section>
  );
}
