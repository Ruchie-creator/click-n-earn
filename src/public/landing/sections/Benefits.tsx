import { Icon, type IconName } from '../icons';
import { Container, Reveal, SectionHead } from '../ui';

const ITEMS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'tag', title: 'Clear Rewards', text: 'Know the reimbursement, incentive, and expected payout before you begin.' },
  { icon: 'upload', title: 'Simple Proof Submission', text: 'Upload your receipt or required proof directly from your account.' },
  { icon: 'chart', title: 'Transparent Status Tracking', text: 'Follow your task from reservation to verification and payout.' },
  { icon: 'bank', title: 'Bank Payouts', text: 'Approved rewards can be paid to your registered bank account where supported.' },
  { icon: 'search', title: 'Task Discovery', text: 'See available opportunities and choose the ones that suit you.' },
  { icon: 'shield', title: 'Secure Review Process', text: 'Every submission goes through a structured review process.' },
];

export function Benefits() {
  return (
    <section id="why" aria-labelledby="why-title" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHead id="why-title" eyebrow="Why Click & Earn" title="Built for clarity, from first task to payout" />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((b, i) => (
            <Reveal as="li" key={b.title} delay={(i % 3) * 70}>
              <div className="ce-card ce-card-hover group h-full p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#1F3558] transition-colors duration-200 group-hover:bg-[#1F3558] group-hover:text-white">
                  <Icon name={b.icon} size={24} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[#172033]">{b.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#667085]">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
