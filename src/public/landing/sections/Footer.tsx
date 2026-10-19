import { LANDING_CONFIG as C } from '../config';
import { Container, LandingLink } from '../ui';

function Col({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  if (!links.length) return null;
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-semibold text-[#172033]">{title}</h2>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <LandingLink href={l.href} className="text-sm text-[#667085] transition-colors hover:text-[#1F3558]">
              {l.label}
            </LandingLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const legal = [
    C.legal.terms ? { label: 'Terms', href: C.legal.terms } : null,
    C.legal.privacy ? { label: 'Privacy', href: C.legal.privacy } : null,
  ].filter(Boolean) as { label: string; href: string }[];
  const support = C.supportEmail ? [{ label: C.supportEmail as string, href: `mailto:${C.supportEmail}` }] : [];

  return (
    <footer className="border-t border-[#D9E2EC] bg-white">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <img src={C.logoSrc} alt={C.brandName} className="h-8 w-auto" width={150} height={32} loading="lazy" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#667085]">
              Find tasks, submit proof, and get your reimbursement plus an incentive after approval.
            </p>
          </div>
          <Col title="Platform" links={[{ label: 'Available Tasks', href: '#tasks' }, { label: 'How It Works', href: '#how-it-works' }]} />
          <Col title="Account" links={[{ label: 'Create Account', href: C.routes.register }, { label: 'Log In', href: C.routes.login }]} />
          <Col title="Legal" links={legal} />
          <Col title="Support" links={support} />
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[#EEF3FA] pt-6 text-xs text-[#667085] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {C.brandName}. All rights reserved.</p>
          <p>Rewards depend on completing and passing verification. Earnings are not guaranteed.</p>
        </div>
      </Container>
    </footer>
  );
}
