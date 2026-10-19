import './landing.css';
import { useSeo } from './hooks';
import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { TrustStrip } from './sections/TrustStrip';
import { TaskPreview } from './sections/TaskPreview';
import { HowItWorks } from './sections/HowItWorks';
import { Payout } from './sections/Payout';
import { Benefits } from './sections/Benefits';
import { HumanStory } from './sections/HumanStory';
import { Showcase } from './sections/Showcase';
import { StatusJourney } from './sections/StatusJourney';
import { Trust, Referral } from './sections/Trust';
import { Faq } from './sections/Faq';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';
import { ScrollToTop } from './ui';

export default function LandingPage() {
  useSeo();
  return (
    <div className="ce-landing min-h-screen">
      <Header />
      <main id="main">
        <Hero />
        <TrustStrip />
        <TaskPreview />
        <HowItWorks />
        <Payout />
        <Benefits />
        <HumanStory />
        <Showcase />
        <StatusJourney />
        <Trust />
        <Referral />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
