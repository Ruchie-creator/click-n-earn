import { useEffect, useState } from 'react';
import { useReveal, usePrefersReducedMotion } from '../hooks';
import { Icon, type IconName } from '../icons';
import { Container, SectionHead } from '../ui';

const STATUSES: { label: string; icon: IconName; text: string }[] = [
  { label: 'Reserved Reward', icon: 'lock', text: 'You’ve reserved the task and can see exactly what it requires and what it’s worth.' },
  { label: 'Proof Submitted', icon: 'upload', text: 'You’ve uploaded the required proof of your purchase.' },
  { label: 'Under Review', icon: 'eye', text: 'Your submission is being checked against the task requirements.' },
  { label: 'Processing', icon: 'clock', text: 'The submission was approved and your payout is being processed.' },
  { label: 'Paid', icon: 'check', text: 'The payout has been sent to your registered bank account.' },
];

export function StatusJourney() {
  const [ref, shown] = useReveal<HTMLDivElement>(0.3);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      setActive(STATUSES.length - 1);
      return;
    }
    if (!auto) return;
    if (active >= STATUSES.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), 1100);
    return () => clearTimeout(t);
  }, [shown, active, auto, reduced]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <section aria-labelledby="status-title" className="relative isolate overflow-hidden bg-white py-20 sm:py-28">
      <div aria-hidden="true" className="ce-status-background"><img src="/public-images/progress-together.png" alt="" loading="lazy" decoding="async" /></div>
      <Container className="relative z-10">
        <SectionHead
          id="status-title"
          eyebrow="Status tracking"
          title="Follow every task, step by step"
          sub="Each task moves through clear statuses, so you always know where things stand. Select a step to learn more."
        />
        <div ref={ref} className="mx-auto mt-14 max-w-4xl">
          <div className="relative">
            <div aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-1 rounded-full bg-[#EEF3FA] sm:block">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4F6FAE] to-[#1F3558] transition-[width] duration-700 ease-out"
                style={{ width: `${(active / (STATUSES.length - 1)) * 100}%` }}
              />
            </div>
            <ol className="relative flex flex-col gap-2 sm:flex-row sm:justify-between">
              {STATUSES.map((s, i) => {
                const done = i <= active;
                return (
                  <li key={s.label} className="sm:flex-1">
                    <button
                      type="button"
                      onClick={() => pick(i)}
                      aria-pressed={i === active}
                      className="group flex w-full min-h-[48px] items-center gap-3 rounded-xl p-2 text-left sm:flex-col sm:text-center"
                    >
                      <span
                        className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                          done ? 'border-[#1F3558] bg-[#1F3558] text-white' : 'border-[#D9E2EC] bg-white text-[#667085]'
                        } ${i === active ? 'scale-105 shadow-[0_10px_24px_-8px_rgba(31,53,88,0.6)]' : ''}`}
                      >
                        <Icon name={s.icon} size={20} />
                      </span>
                      <span className={`text-sm font-semibold sm:mt-3 ${done ? 'text-[#172033]' : 'text-[#667085]'}`}>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="ce-card mt-8 p-6 text-center sm:p-8" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4F6FAE]">Step {active + 1} of {STATUSES.length}</p>
            <h3 className="mt-2 text-xl font-semibold text-[#172033]">{STATUSES[active].label}</h3>
            <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-[#667085]">{STATUSES[active].text}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
