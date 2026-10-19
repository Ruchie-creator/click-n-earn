import type { AnchorHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from 'react';
import { usePrefersReducedMotion, useReveal, useScrolled } from './hooks';
import { Icon } from './icons';

/**
 * If your app uses react-router, swap this <a> for <Link to={href}> so navigation is client-side:
 *   import { Link } from 'react-router-dom';
 *   if (!href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto:')) return <Link to={href} ...>
 */
export function LandingLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    rest.onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (href.startsWith('/') && !href.startsWith('//')) {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('click-earn:navigate', { detail: { href } }));
    }
  };
  return (
    <a href={href} {...rest} onClick={onClick}>
      {children}
    </a>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  const [ref, shown] = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      className={`ce-reveal ${shown ? 'is-in' : ''} ${className}`}
      style={{ '--d': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

type Variant = 'primary' | 'secondary' | 'light' | 'outline-light';
export function Btn({
  href,
  variant = 'primary',
  arrow = false,
  children,
  className = '',
  onClick,
}: {
  href: string;
  variant?: Variant;
  arrow?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const v = {
    primary: 'ce-btn-primary',
    secondary: 'ce-btn-secondary',
    light: 'ce-btn-light',
    'outline-light': 'ce-btn-outline-light',
  }[variant];
  return (
    <LandingLink href={href} onClick={onClick} className={`ce-btn ${v} ${className}`}>
      {children}
      {arrow && <Icon name="arrow" size={18} className="ce-arrow" />}
    </LandingLink>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  id,
  dark = false,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  id?: string;
  dark?: boolean;
  align?: 'center' | 'left';
}) {
  return (
    <Reveal className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${dark ? 'text-[#9db4de]' : 'text-[#4F6FAE]'}`}>{eyebrow}</p>
      <h2
        id={id}
        className={`mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-[#172033]'}`}
      >
        {title}
      </h2>
      {sub && <p className={`mt-4 text-base leading-relaxed sm:text-lg ${dark ? 'text-[#c5d2ea]' : 'text-[#667085]'}`}>{sub}</p>}
    </Reveal>
  );
}

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

/** An accessible return-to-top control shared by the public pages. */
export function ScrollToTop() {
  const visible = useScrolled(420);
  const reducedMotion = usePrefersReducedMotion();
  return <button type="button" className={`ce-scroll-top ${visible ? 'is-visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })} aria-label="Scroll back to top" tabIndex={visible ? 0 : -1}><Icon name="arrow" size={19} className="-rotate-90" /><span>Top</span></button>;
}

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
