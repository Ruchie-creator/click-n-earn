import { Icon } from '../icons';
import { Btn, Container, Reveal } from '../ui';
import { LANDING_CONFIG as C } from '../config';

const points = [
  'Choose tasks that fit you',
  'See the reward before you start',
  'Track progress from task to payout',
];

export function HumanStory() {
  return (
    <section aria-labelledby="human-story-title" className="bg-white py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_.9fr] lg:gap-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-[28px] bg-[#EEF3FA]">
              <img src="/public-images/tasks-hero.webp" alt="Person comfortably working on a laptop at home" loading="lazy" width="1400" height="934" className="ce-human-story-photo" />
              <div className="absolute bottom-5 left-5 rounded-xl bg-white/92 px-4 py-3 shadow-lg backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4F6FAE]">Your pace</p>
                <p className="mt-0.5 text-sm font-semibold text-[#172033]">Tasks on your own time</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#4F6FAE]">Designed around real life</p>
            <h2 id="human-story-title" className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-[#172033] sm:text-4xl">Earn on your own time.</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#667085]">Explore the tasks available today, keep the terms in view, and return to your account whenever you are ready to continue.</p>
            <ul className="mt-7 space-y-4">
              {points.map((point) => <li key={point} className="flex items-center gap-3 text-[15px] font-medium text-[#172033]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#ECFDF3] text-[#16A34A]"><Icon name="check" size={16} /></span>{point}</li>)}
            </ul>
            <Btn href={C.routes.tasks} arrow className="mt-8">Explore available tasks</Btn>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
