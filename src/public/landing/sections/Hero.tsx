import { LANDING_CONFIG as C } from '../config';
import { Btn, Container } from '../ui';

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
        </div>
      </Container>
    </section>
  );
}
