import { LANDING_CONFIG as C } from '../config';
import { Icon } from '../icons';
import { Btn, Container } from '../ui';

function HeroVisual() {
  const payout = 57;

  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none" role="img" aria-label="Illustrative example of a Click & Earn task showing a $47 reimbursement plus a $10 incentive for an expected payout of $57. Sample data.">
      <div aria-hidden="true" className="relative">
        {/* back card */}
        <div className="ce-card absolute -right-3 top-10 hidden h-[88%] w-[92%] rotate-[2.5deg] opacity-70 sm:block" />

        {/* main card */}
        <div className="ce-card relative p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-[#EEF3FA] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#4F6FAE]">
              Digital product
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" /> Available
            </span>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-[#172033]">Example digital task</h3>
          <p className="mt-1 text-sm text-[#667085]">Follow the task instructions, purchase through the external checkout, then submit proof.</p>

          <div className="mt-5 rounded-2xl border border-[#D9E2EC] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">Purchase reimbursement</span>
              <span className="font-semibold text-[#172033]">$47</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-[#667085]">Incentive</span>
              <span className="font-semibold text-[#16A34A]">+$10</span>
            </div>
            <div className="my-3 border-t border-dashed border-[#D9E2EC]" />
            <div className="flex items-end justify-between">
              <span className="text-sm font-medium text-[#172033]">Expected payout</span>
              <span className="text-4xl font-semibold tabular-nums tracking-tight text-[#1F3558]">${payout}</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="ce-btn ce-btn-primary flex-1 !cursor-default">Reserve Task</div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#D9E2EC] text-[#4F6FAE]">
              <Icon name="eye" />
            </div>
          </div>

          {/* progress */}
          <div className="mt-5">
            <div className="flex justify-between text-[11px] font-medium text-[#667085]">
              <span>Reserved</span><span>Proof</span><span>Review</span><span>Paid</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF3FA]">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#4F6FAE] to-[#1F3558]" />
            </div>
          </div>
        </div>

        {/* floating micro-cards */}
        <div className="ce-float absolute -top-7 left-6 hidden items-center gap-2.5 rounded-2xl ce-glass px-3.5 py-2.5 shadow-[0_18px_40px_-18px_rgba(31,53,88,0.45)] sm:flex" style={{ '--d': '0ms' } as React.CSSProperties}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3FA] text-[#4F6FAE]"><Icon name="lock" size={18} /></span>
          <span className="text-sm font-semibold text-[#172033]">Reward reserved</span>
        </div>
        <div className="ce-float-slow absolute -bottom-10 right-6 hidden items-center gap-2.5 rounded-2xl ce-glass px-3.5 py-2.5 shadow-[0_18px_40px_-18px_rgba(31,53,88,0.45)] sm:flex" style={{ '--d': '600ms' } as React.CSSProperties}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16A34A]/10 text-[#16A34A]"><Icon name="check" size={18} /></span>
          <span className="text-sm font-semibold text-[#172033]">Proof approved</span>
        </div>
        <div className="ce-float absolute -bottom-10 left-6 hidden items-center gap-2.5 rounded-2xl ce-glass px-3.5 py-2.5 shadow-[0_18px_40px_-18px_rgba(31,53,88,0.45)] sm:flex" style={{ '--d': '1200ms' } as React.CSSProperties}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3FA] text-[#1F3558]"><Icon name="bank" size={18} /></span>
          <span className="text-sm font-semibold text-[#172033]">Payout processing</span>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-[#667085] sm:mt-16">Illustrative sample — not live earnings data.</p>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative pt-[68px]" aria-labelledby="hero-title">
      {/* background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EEF3FA] via-[#F8FAFC] to-[#F8FAFC]" />
        <div className="ce-orb absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-[#4F6FAE]/20 blur-[90px]" />
        <div className="ce-orb absolute -right-24 top-40 h-[380px] w-[380px] rounded-full bg-[#2C2C55]/15 blur-[100px]" style={{ animationDelay: '-8s' }} />
      </div>

      <Container className="relative grid items-center gap-14 pb-20 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
        <div>
          <p className="ce-enter inline-flex items-center gap-2 rounded-full border border-[#D9E2EC] bg-white/80 px-3.5 py-1.5 text-[13px] font-medium text-[#1F3558]" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#4F6FAE]" /> Task-based rewards, reimbursed and verified
          </p>
          <h1
            id="hero-title"
            className="ce-enter mt-5 text-[40px] font-semibold leading-[1.06] tracking-tight text-[#172033] sm:text-6xl lg:text-[64px]"
            style={{ '--d': '60ms' } as React.CSSProperties}
          >
            Complete tasks.
            <br />
            Get reimbursed.
            <br />
            <span className="bg-gradient-to-r from-[#1F3558] to-[#4F6FAE] bg-clip-text text-transparent">Earn more.</span>
          </h1>
          <p className="ce-enter mt-6 max-w-xl text-lg leading-relaxed text-[#667085]" style={{ '--d': '120ms' } as React.CSSProperties}>
            Find available tasks, follow the purchase instructions, submit proof, and receive your reimbursement plus an incentive after approval.
          </p>
          <div className="ce-enter mt-8 flex flex-col gap-3 sm:flex-row" style={{ '--d': '180ms' } as React.CSSProperties}>
            <Btn href={C.routes.tasks} arrow>Browse Available Tasks</Btn>
            <Btn href={C.routes.register} variant="secondary">Create Free Account</Btn>
          </div>
          <p className="ce-enter mt-6 text-sm text-[#667085]" style={{ '--d': '240ms' } as React.CSSProperties}>
            Clear task requirements <span aria-hidden="true">•</span> Proof-based verification <span aria-hidden="true">•</span> Bank payouts
          </p>
        </div>

        <div className="ce-enter ce-hero-photo-stage" style={{ '--d': '200ms' } as React.CSSProperties}>
          <img src="/public-images/hero-work.webp" alt="Person working from home on a laptop" width="1600" height="1067" className="ce-hero-photo" />
          <div className="ce-hero-product-card">
            <HeroVisual />
          </div>
        </div>
      </Container>
    </section>
  );
}
