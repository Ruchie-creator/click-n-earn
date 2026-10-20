import { useEffect, useState } from 'react';
import { api, type ApiFaq } from '../../../api';
import { Icon } from '../icons';
import { Container, Reveal, SectionHead } from '../ui';

export function Faq() {
  const [faqs, setFaqs] = useState<ApiFaq[]>([]);
  const [open, setOpen] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api.publicFaqs({ cache: 'no-store' })
      .then((response) => { if (active) setFaqs(response.data); })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-white py-20 sm:py-28">
      <Container className="max-w-3xl">
        <SectionHead id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <Reveal className="mt-12 divide-y divide-[#D9E2EC] overflow-hidden rounded-2xl border border-[#D9E2EC] bg-white">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            const buttonId = `faq-btn-${faq.id}`;
            const panelId = `faq-panel-${faq.id}`;
            return (
              <div key={faq.id}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-[16px] font-semibold text-[#172033] transition-colors hover:bg-[#F8FAFC] sm:px-6"
                  >
                    <span>{faq.question}</span>
                    <Icon name="chevron" size={20} className={`shrink-0 text-[#4F6FAE] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={buttonId} className="ce-collapse" data-open={isOpen}>
                  <div><p className="px-5 pb-5 text-[15px] leading-relaxed text-[#667085] sm:px-6">{faq.answer}</p></div>
                </div>
              </div>
            );
          })}
          {loading && <p className="px-5 py-6 text-sm text-[#667085] sm:px-6">Loading common questions…</p>}
          {!loading && faqs.length === 0 && <p className="px-5 py-6 text-sm text-[#667085] sm:px-6">{loadFailed ? 'Questions are unavailable right now. Please check back soon.' : 'There are no published questions yet.'}</p>}
        </Reveal>
      </Container>
    </section>
  );
}
