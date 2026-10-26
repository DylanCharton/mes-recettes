import { BackLink } from '../components/BackLink';
import { Onboarding } from '../components/Onboarding';

/** Le tutoriel de la bibliothèque vide, à revoir depuis les réglages. */
export function TutorialPage() {
  return (
    <section>
      <BackLink to="/settings" />
      <Onboarding replay />
    </section>
  );
}
