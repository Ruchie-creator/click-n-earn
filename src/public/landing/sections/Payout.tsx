import { Icon } from '../icons';
import { Container, Reveal, SectionHead } from '../ui';

export function Payout() {
  return (
    <section id="rewards" aria-labelledby="rewards-title" className="py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHead
            id="rewards-title"
            align="left"
            eyebrow="How rewards work"
            title="You always know what the task is worth."
            sub="Every task clearly shows its reimbursement and incentive before you reserve it. After successful verification, the approved amount moves through the payout process."
          />
          <Reveal delay={100}>
            <ul className="mt-8 space-y-4 text-[15px] text-[#172033]">
              {[
                'Purchase reimbursement covers the task’s listed purchase amount.',
                'The incentive is the extra reward listed on the task.',
                'Eligible payouts are sent to your registered bank account through our payment infrastructure.',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16A34A]/10 text-[#16A34A]">
                    <Icon name="check" size={14} strokeWidth={2.5} />
                  </span>
                  <span className="leading-relaxed text-[#667085]">{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[#667085]">Rewards depend on completing and passing verification. Earnings are never guaranteed.</p>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="relative ce-reward-photo-stage">
            <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[32px] bg-gradient-to-br from-[#EEF3FA] to-transparent" />
            <img src="/public-images/rewards-at-home.png" alt="Member checking a reward update on her phone" loading="lazy" decoding="async" className="ce-reward-photo" />
            <div className="ce-card ce-reward-breakdown-card p-6 sm:p-8" role="group" aria-label="Example reward breakdown. Sample data.">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#172033]">Reward breakdown</p>
                <span className="rounded-md bg-[#EEF3FA] px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#4F6FAE]">Example</span>
              </div>
              <dl className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <dt className="text-[#667085]">Purchase reimbursement</dt>
                  <dd className="text-lg font-semibold tabular-nums text-[#172033]">$47</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#667085]">Incentive</dt>
                  <dd className="text-lg font-semibold tabular-nums text-[#16A34A]">+$10</dd>
                </div>
                <div className="border-t border-dashed border-[#D9E2EC]" />
                <div className="flex items-end justify-between rounded-2xl bg-[#1F3558] px-5 py-4 text-white">
                  <dt className="text-sm font-medium text-[#c5d2ea]">Expected payout</dt>
                  <dd className="text-4xl font-semibold tabular-nums tracking-tight">$57</dd>
                </div>
              </dl>
              <p className="mt-5 text-xs text-[#667085]">Sample figures for illustration only.</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
