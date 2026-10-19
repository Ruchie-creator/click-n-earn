import { Icon, type IconName } from '../icons';
import { Container, Reveal, SectionHead } from '../ui';
import { useReveal } from '../hooks';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'search', title: 'Choose a Task', text: 'Browse available opportunities and review the requirements and reward.' },
  { icon: 'lock', title: 'Reserve It', text: 'Reserve the task so you know exactly what needs to be completed.' },
  { icon: 'upload', title: 'Complete & Submit Proof', text: 'Follow the instructions, purchase through the external checkout, and upload your proof.' },
  { icon: 'shield', title: 'We Review It', text: 'The submission is checked before your reward is approved.' },
  { icon: 'wallet', title: 'Get Paid', text: 'Approved reimbursement and incentive move to payout processing.' },
];

export function HowItWorks() {
  const [ref, shown] = useReveal<HTMLOListElement>(0.2);
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative bg-white py-20 sm:py-28">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D9E2EC] to-transparent" aria-hidden="true" />
      <Container>
        <SectionHead
          id="how-title"
          eyebrow="How it works"
          title="Earn in a few simple steps"
          sub="Click & Earn doesn't process the product purchase — you buy through the task's external checkout, then submit proof here."
        />

        <ol ref={ref} className={`relative mt-14 grid gap-5 lg:grid-cols-5 ${shown ? 'is-in' : ''}`}>
          {/* desktop connector */}
          <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-[34px] hidden h-px bg-[#D9E2EC] lg:block">
            <div className="ce-line h-full bg-[#4F6FAE]" style={{ '--d': '200ms' } as React.CSSProperties} />
          </div>
          {/* mobile connector */}
          <div aria-hidden="true" className="absolute bottom-10 left-[27px] top-10 w-px bg-[#D9E2EC] lg:hidden">
            <div className="ce-line-v h-full w-full bg-[#4F6FAE]" />
          </div>

          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 80} className="relative">
              <div className="flex gap-4 lg:block lg:text-center">
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D9E2EC] bg-white text-[#1F3558] shadow-[0_10px_24px_-14px_rgba(31,53,88,0.5)] lg:mx-auto lg:h-[68px] lg:w-[68px]">
                  <Icon name={s.icon} size={26} />
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1F3558] px-1.5 text-[11px] font-semibold text-white">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="ce-card ce-card-hover flex-1 p-5 lg:mt-5 lg:min-h-[150px]">
                  <h3 className="text-base font-semibold text-[#172033]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#667085]">{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
