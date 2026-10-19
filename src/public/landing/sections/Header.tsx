import { useEffect, useState } from 'react';
import { LANDING_CONFIG as C } from '../config';
import { useActiveSection, useScrolled } from '../hooks';
import { Icon } from '../icons';
import { Btn, LandingLink } from '../ui';

const NAV = [
  { id: 'tasks', label: 'Available Tasks' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'why', label: 'Why Click & Earn' },
  { id: 'faq', label: 'FAQ' },
];

export function Header() {
  const scrolled = useScrolled();
  const active = useActiveSection(NAV.map((n) => n.id));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-200 ${
        scrolled || open
          ? 'bg-white/85 shadow-[0_1px_0_#D9E2EC,0_10px_30px_-20px_rgba(31,53,88,0.35)] backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[#1F3558]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[68px] w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <LandingLink href="#top" aria-label={`${C.brandName} home`} className="flex items-center">
          <img src={C.logoSrc} alt={C.brandName} className="h-8 w-auto sm:h-9" width={150} height={36} />
        </LandingLink>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="ce-navlink" aria-current={active === n.id ? 'true' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LandingLink
            href={C.routes.login}
            className="rounded-lg px-4 py-2 text-[15px] font-semibold text-[#1F3558] transition-colors hover:bg-[#EEF3FA]"
          >
            Log In
          </LandingLink>
          <Btn href={C.routes.register} className="!min-h-[42px] !px-5 !py-2.5">
            Create Account
          </Btn>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#1F3558] hover:bg-[#EEF3FA] lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-[#D9E2EC] bg-white px-5 pb-6 pt-3 lg:hidden"
        style={{ maxHeight: 'calc(100dvh - 68px)', overflowY: 'auto' }}
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => setOpen(false)}
              className="flex min-h-[52px] items-center justify-between border-b border-[#EEF3FA] text-[17px] font-medium text-[#172033]"
            >
              {n.label}
              <Icon name="arrow" size={18} className="text-[#4F6FAE]" />
            </a>
          ))}
        </nav>
        <div className="mt-5 grid gap-3">
          <Btn href={C.routes.register} onClick={() => setOpen(false)} className="w-full">
            Create Account
          </Btn>
          <Btn href={C.routes.login} variant="secondary" onClick={() => setOpen(false)} className="w-full">
            Log In
          </Btn>
        </div>
      </div>
    </header>
  );
}
