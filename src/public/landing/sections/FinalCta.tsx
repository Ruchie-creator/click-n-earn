import { LANDING_CONFIG as C } from '../config';
import { Btn, Container, Reveal } from '../ui';

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-5 py-20 sm:px-8 sm:py-28">
      <Container className="!px-0">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1F3558] via-[#1F3558] to-[#2C2C55] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden="true" className="ce-grid-dark absolute inset-0" />
          <div aria-hidden="true" className="ce-orb absolute -right-16 -top-16 h-72 w-72 rounded-full bg-[#4F6FAE]/40 blur-[90px]" />
          <div aria-hidden="true" className="ce-orb absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-[#4F6FAE]/25 blur-[100px]" style={{ animationDelay: '-9s' }} />
          <Reveal className="relative">
            <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Ready to start earning?</h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#c5d2ea] sm:text-lg">
              Browse available tasks, choose an opportunity, and see exactly what you can earn before you begin.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Btn href={C.routes.tasks} variant="light" arrow>Browse Tasks</Btn>
              <Btn href={C.routes.register} variant="outline-light">Create Account</Btn>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
