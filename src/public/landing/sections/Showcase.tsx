import { useRef, useState, type KeyboardEvent } from 'react';
import { Container, Reveal, SectionHead } from '../ui';

const TABS = ['Available Tasks', 'My Tasks', 'Proof Review', 'Payouts'] as const;
type Tab = (typeof TABS)[number];

const CALLOUT: Record<Tab, string> = {
  'Available Tasks': 'Reward shown up front',
  'My Tasks': 'Every task, one status',
  'Proof Review': 'Clear review outcome',
  Payouts: 'Track each payout',
};

const Bar = ({ w, className = '' }: { w: string; className?: string }) => (
  <div className={`h-2.5 rounded bg-[#EEF3FA] ${className}`} style={{ width: w }} />
);

function Pill({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'amber' }) {
  const c = { blue: 'bg-[#EEF3FA] text-[#4F6FAE]', green: 'bg-[#16A34A]/10 text-[#16A34A]', amber: 'bg-[#D97706]/10 text-[#D97706]' }[tone];
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}

function Row({ title, meta, right }: { title: string; meta: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#D9E2EC] bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#172033]">{title}</p>
        <p className="text-xs text-[#667085]">{meta}</p>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function Panel({ tab }: { tab: Tab }) {
  if (tab === 'Available Tasks')
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[['Example task one', '$47', '+$10', '$57'], ['Example task two', '$29', '+$8', '$37']].map(([t, r, i, p]) => (
          <div key={t} className="rounded-xl border border-[#D9E2EC] bg-white p-4">
            <Pill>Digital product</Pill>
            <p className="mt-3 text-sm font-semibold text-[#172033]">{t}</p>
            <Bar w="80%" className="mt-2" />
            <div className="mt-4 flex items-end justify-between text-xs text-[#667085]">
              <span>{r} <span className="text-[#16A34A]">{i}</span></span>
              <span className="text-lg font-semibold text-[#1F3558]">{p}</span>
            </div>
          </div>
        ))}
      </div>
    );
  if (tab === 'My Tasks')
    return (
      <div className="space-y-2.5">
        <Row title="Example task one" meta="Reserved" right={<Pill>Reserved</Pill>} />
        <Row title="Example task two" meta="Proof submitted" right={<Pill tone="amber">Under review</Pill>} />
        <Row title="Example task three" meta="Approved" right={<Pill tone="green">Processing</Pill>} />
      </div>
    );
  if (tab === 'Proof Review')
    return (
      <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
        <div className="flex min-h-[130px] items-center justify-center rounded-xl border border-dashed border-[#4F6FAE]/50 bg-[#EEF3FA] text-xs font-medium text-[#4F6FAE]">Uploaded receipt</div>
        <div className="space-y-2.5 rounded-xl border border-[#D9E2EC] bg-white p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold text-[#172033]">Review status</p><Pill tone="green">Approved</Pill></div>
          <Bar w="90%" /><Bar w="70%" /><Bar w="55%" />
        </div>
      </div>
    );
  return (
    <div className="space-y-2.5">
      <Row title="Payout · Example task one" meta="Expected payout $57" right={<Pill tone="amber">Processing</Pill>} />
      <Row title="Payout · Example task three" meta="Expected payout $41" right={<Pill tone="green">Paid</Pill>} />
      <Row title="Payout · Example task two" meta="Awaiting approval" right={<Pill>Pending</Pill>} />
    </div>
  );
}

export function Showcase() {
  const [tab, setTab] = useState<Tab>('Available Tasks');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[n]);
    refs.current[n]?.focus();
  };

  return (
    <section aria-labelledby="product-title" className="py-20 sm:py-28">
      <Container>
        <SectionHead
          id="product-title"
          eyebrow="The product"
          title="Everything in one place"
          sub="Browse tasks, track each one, submit proof and follow your payouts from your account."
        />

        <Reveal className="mt-12" delay={80}>
          <div role="tablist" aria-label="Product views" className="mx-auto mb-6 flex max-w-full flex-wrap justify-center gap-2">
            {TABS.map((t, i) => (
              <button
                key={t}
                ref={(el) => { refs.current[i] = el; }}
                role="tab"
                id={`tab-${i}`}
                aria-selected={tab === t}
                aria-controls="showcase-panel"
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
                onKeyDown={(e) => onKey(e, i)}
                className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold transition-colors duration-200 ${
                  tab === t ? 'bg-[#1F3558] text-white shadow-[0_8px_20px_-10px_rgba(31,53,88,0.7)]' : 'bg-white text-[#667085] ring-1 ring-[#D9E2EC] hover:text-[#1F3558]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative mx-auto max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-[#D9E2EC] bg-white shadow-[0_40px_80px_-40px_rgba(31,53,88,0.45)]">
              <div className="flex items-center gap-2 border-b border-[#D9E2EC] bg-[#F8FAFC] px-4 py-3" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D9E2EC]" /><span className="h-2.5 w-2.5 rounded-full bg-[#D9E2EC]" /><span className="h-2.5 w-2.5 rounded-full bg-[#D9E2EC]" />
                <div className="mx-auto h-6 w-1/2 rounded-md bg-white ring-1 ring-[#D9E2EC]" />
              </div>
              <div className="grid min-h-[300px] grid-cols-[auto_1fr]">
                <div className="hidden w-44 space-y-2 border-r border-[#D9E2EC] bg-[#F8FAFC] p-4 sm:block" aria-hidden="true">
                  {TABS.map((t) => (
                    <div key={t} className={`rounded-lg px-3 py-2 text-xs font-semibold ${t === tab ? 'bg-[#1F3558] text-white' : 'text-[#667085]'}`}>{t}</div>
                  ))}
                </div>
                <div id="showcase-panel" role="tabpanel" aria-labelledby={`tab-${TABS.indexOf(tab)}`} className="col-span-2 bg-[#F8FAFC]/60 p-5 sm:col-span-1 sm:p-6">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#667085]">{tab}</p>
                  <Panel tab={tab} />
                </div>
              </div>
            </div>
            <div aria-hidden="true" className="ce-float absolute -right-2 -top-4 hidden rounded-xl bg-[#1F3558] px-3.5 py-2 text-xs font-semibold text-white shadow-lg md:block">
              {CALLOUT[tab]}
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-[#667085]">Illustrative interface with sample data.</p>
        </Reveal>
      </Container>
    </section>
  );
}
