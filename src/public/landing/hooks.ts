import { useEffect, useRef, useState } from 'react';
import { LANDING_CONFIG } from './config';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Fires once when the element enters the viewport. */
export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, shown] as const;
}

export function useScrolled(offset = 12): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}

export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

export function useCountUp(target: number, start: boolean, duration = 900): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, duration, reduced]);
  return start ? value : 0;
}

/** Sets title / description / canonical / Open Graph. Swap for react-helmet if you already use it. */
export function useSeo() {
  useEffect(() => {
    const { title, description } = LANDING_CONFIG.seo;
    const siteUrl: string = LANDING_CONFIG.seo.siteUrl;
    const ogImage: string = LANDING_CONFIG.seo.ogImage;
    const origin = siteUrl || window.location.origin;
    const url = origin + window.location.pathname;
    const prevTitle = document.title;
    document.title = title;

    const touched: Array<{ el: Element; created: boolean; prev: string | null; attr: string }> = [];
    const setTag = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      let created = false;
      if (!el) {
        el = create();
        document.head.appendChild(el);
        created = true;
      }
      touched.push({ el, created, prev: el.getAttribute(attr), attr });
      el.setAttribute(attr, value);
    };
    const meta = (key: 'name' | 'property', name: string, value: string) =>
      setTag(
        `meta[${key}="${name}"]`,
        () => {
          const m = document.createElement('meta');
          m.setAttribute(key, name);
          return m;
        },
        'content',
        value,
      );

    meta('name', 'description', description);
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:type', 'website');
    meta('property', 'og:url', url);
    meta('property', 'og:site_name', LANDING_CONFIG.brandName);
    meta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
    if (ogImage) meta('property', 'og:image', ogImage.startsWith('http') ? ogImage : origin + ogImage);
    setTag(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        return l;
      },
      'href',
      url,
    );

    return () => {
      document.title = prevTitle;
      touched.forEach(({ el, created, prev, attr }) => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute(attr, prev);
      });
    };
  }, []);
}
