import { LANDING_CONFIG as C } from '../config';
import { Icon, type IconName } from '../icons';
import { Btn, Container, Reveal, SectionHead } from '../ui';

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'Secure account authentication', text: 'Your tasks and payout details sit behind your signed-in account.' },
  { icon: 'eye', title: 'Controlled proof access', text: 'Submitted proof is only available to you and the review team.' },
  { icon: 'shield', title: 'Structured verification', text: 'Every submission is checked against the task’s requirements.' },
  { icon: 'chart', title: 'Payout status tracking', text: 'See where each payout is, from approval through to payment.' },
  { icon: 'bank', title: 'Secured bank details handling', text: 'Bank details are handled through secured backend processes.' },
  { icon: 'wallet', title: 'Established payment infrastructure', text: 'Eligible payouts are sent through Airwallex. You don’t need an Airwallex account.' },
];

export function Trust() {
  return (
    <section aria-labelledby="trust-title" className="py-20 sm:py-28">
      <Container>
        <SectionHead
          id="trust-title"
          eyebrow="Trust & security"
          title="A careful process behind every payout"
        />
        <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map((p, i) => (
            <Reveal as="li" key={p.title} delay={(i % 3) * 70}>
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#1F3558]">
                  <Icon name={p.icon} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#172033]">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#667085]">{p.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Only rendered when LANDING_CONFIG.referralsEnabled is true. Confirm the qualification rule before enabling. */
export function Referral() {
  if (!C.referralsEnabled) return null;
  return (
    <section aria-labelledby="referral-title" className="pb-20 sm:pb-28">
      <Container>
        <Reveal className="ce-card flex flex-col items-start justify-between gap-6 bg-gradient-to-br from-white to-[#EEF3FA] p-8 sm:flex-row sm:items-center sm:p-10">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3558] text-white"><Icon name="users" /></span>
            <div>
              <h2 id="referral-title" className="text-2xl font-semibold text-[#172033]">Invite friends. Earn when they succeed.</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#667085]">
                Referral rewards apply once the friend you invite completes an approved task — signing up alone doesn’t qualify. Terms apply.
              </p>
            </div>
          </div>
          <Btn href={C.routes.register}>Create Account</Btn>
        </Reveal>
      </Container>
    </section>
  );
}
