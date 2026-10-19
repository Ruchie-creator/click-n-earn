import { Icon, type IconName } from '../icons';
import { Container, Reveal } from '../ui';

const ITEMS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'tag', title: 'Transparent task rewards', text: 'See the payout before you reserve' },
  { icon: 'receipt', title: 'Proof-based verification', text: 'Every submission is reviewed' },
  { icon: 'lock', title: 'Secure account access', text: 'Sign in to manage your tasks' },
  { icon: 'bank', title: 'Bank payouts', text: 'Approved rewards paid to your bank' },
];

export function TrustStrip() {
  return (
    <section aria-label="Platform highlights" className="relative z-10 -mt-6 pb-4">
      <Container>
        <Reveal className="ce-card grid grid-cols-1 gap-px overflow-hidden !rounded-2xl bg-[#D9E2EC] sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((i) => (
            <div key={i.title} className="flex items-center gap-3.5 bg-white px-5 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#1F3558]">
                <Icon name={i.icon} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[#172033]">{i.title}</p>
                <p className="text-sm text-[#667085]">{i.text}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
