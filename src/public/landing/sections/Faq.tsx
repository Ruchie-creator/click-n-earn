import { useState } from 'react';
import { Icon } from '../icons';
import { Container, Reveal, SectionHead } from '../ui';

/** Review each answer against your real platform rules before launch. */
export const FAQS: { q: string; a: string }[] = [
  { q: 'What is Click & Earn?', a: 'Click & Earn is a task platform. You reserve an available task, follow its instructions, purchase through the external checkout, submit proof, and — once approved — receive the listed reimbursement plus an incentive.' },
  { q: 'How do tasks work?', a: 'Browse available tasks, review the requirements and reward, and reserve the one you want. Complete it as instructed, upload your proof, and track its status from your account until it is reviewed and paid.' },
  { q: 'Do I need to pay for products myself?', a: 'Yes. Purchases are made by you through the task’s external checkout; Click & Earn doesn’t process that purchase. The task’s purchase reimbursement is part of your expected payout after your submission is approved.' },
  { q: 'How is my expected payout calculated?', a: 'Expected payout is the purchase reimbursement plus the incentive, both shown on the task before you reserve it. The amount is paid after your proof is verified.' },
  { q: 'What proof do I need to submit?', a: 'Each task lists what is required, typically a receipt or other purchase proof. You upload it from your account.' },
  { q: 'How long does review take?', a: 'Every submission goes through a structured review. Timing can vary, so we don’t promise a specific turnaround — you can follow the status of your task in your account.' },
  { q: 'How do payouts work?', a: 'After approval, the reimbursement and incentive move to payout processing and are sent to your registered bank account where supported. Payouts aren’t guaranteed to be instant.' },
  { q: 'Do I need an Airwallex account?', a: 'No. You don’t need an Airwallex account. You provide supported bank payout details, and eligible payouts are sent through our payment infrastructure.' },
  { q: 'Can a task expire after I reserve it?', a: 'A reserved task is held for you to complete, but reservations can have time limits. Check the task details after you reserve so you know what applies.' },
  { q: 'What happens if my proof needs changes?', a: 'If your submission doesn’t meet the requirements, you’ll see that in the task’s status and can follow the instructions shown to correct it where allowed.' },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-white py-20 sm:py-28">
      <Container className="max-w-3xl">
        <SectionHead id="faq-title" eyebrow="FAQ" title="Questions, answered" />
        <Reveal className="mt-12 divide-y divide-[#D9E2EC] overflow-hidden rounded-2xl border border-[#D9E2EC] bg-white">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <h3>
                  <button
                    type="button"
                    id={`faq-btn-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-[60px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-[16px] font-semibold text-[#172033] transition-colors hover:bg-[#F8FAFC] sm:px-6"
                  >
                    {f.q}
                    <Icon name="chevron" size={20} className={`shrink-0 text-[#4F6FAE] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </h3>
                <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} className="ce-collapse" data-open={isOpen}>
                  <div>
                    <p className="px-5 pb-5 text-[15px] leading-relaxed text-[#667085] sm:px-6">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}
