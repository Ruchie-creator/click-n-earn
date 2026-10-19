import { useEffect, useState } from 'react';
import { api, type PublicTask as ApiPublicTask } from '../../../api';
import { LANDING_CONFIG as C } from '../config';
import { Icon } from '../icons';
import { Btn, Container, LandingLink, money, Reveal, SectionHead } from '../ui';

type PublicTask = ApiPublicTask;

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'empty' } | { kind: 'ready'; tasks: PublicTask[] };

function useTasks(): State {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    const ctrl = new AbortController();
    api.publicTasks({ per_page: String(C.maxPreviewTasks) }, { signal: ctrl.signal })
      .then((json) => {
        const tasks = json.data.items.slice(0, C.maxPreviewTasks);
        setState(tasks.length ? { kind: 'ready', tasks } : { kind: 'empty' });
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setState({ kind: 'error' });
      });
    return () => ctrl.abort();
  }, []);
  return state;
}

function TaskCard({ task }: { task: PublicTask }) {
  return (
    <article className="ce-card ce-card-hover flex h-full flex-col p-5 sm:p-6">
      <div className="ce-task-preview-image">
        <img src={task.image || '/public-images/tasks-hero.webp'} alt="" loading="lazy" decoding="async" />
        <span className="ce-task-preview-image-label">{task.category}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-[#4F6FAE]">Featured task</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#16A34A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" /> Available
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug text-[#172033]">{task.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#667085]">{task.short_description}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[#667085]">Reimbursement</dt>
          <dd className="mt-0.5 font-semibold text-[#172033]">{money(task.reimbursement_amount, C.currency)}</dd>
        </div>
        <div>
          <dt className="text-[#667085]">Incentive</dt>
          <dd className="mt-0.5 font-semibold text-[#16A34A]">+{money(task.incentive, C.currency)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-end justify-between rounded-xl bg-[#EEF3FA] px-4 py-3">
        <span className="text-sm font-medium text-[#1F3558]">Expected payout</span>
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-[#1F3558]">{money(task.expected_payout, C.currency)}</span>
      </div>
      <div className="mt-5 pt-1">
        <LandingLink
          href={C.taskHref(task)}
          className="ce-btn ce-btn-secondary w-full"
          aria-label={`View task: ${task.title}`}
        >
          View Task <Icon name="arrow" size={18} className="ce-arrow" />
        </LandingLink>
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="ce-card p-6" aria-hidden="true">
      <div className="ce-skeleton h-5 w-24" />
      <div className="ce-skeleton mt-5 h-6 w-3/4" />
      <div className="ce-skeleton mt-3 h-4 w-full" />
      <div className="ce-skeleton mt-6 h-16 w-full" />
      <div className="ce-skeleton mt-5 h-12 w-full" />
    </div>
  );
}

export function TaskPreview() {
  const state = useTasks();
  return (
    <section id="tasks" aria-labelledby="tasks-title" className="py-20 sm:py-28">
      <Container>
        <SectionHead
          id="tasks-title"
          eyebrow="Available tasks"
          title="Tasks worth your time"
          sub="Every task shows its reimbursement, incentive and expected payout before you reserve it."
        />

        <div className="mt-12" aria-live="polite" aria-busy={state.kind === 'loading'}>
          {state.kind === 'loading' && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} />)}
            </div>
          )}
          {state.kind === 'ready' && (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {state.tasks.map((t, i) => (
                <Reveal as="li" key={String(t.id)} delay={Math.min(i, 5) * 70}>
                  <TaskCard task={t} />
                </Reveal>
              ))}
            </ul>
          )}
          {(state.kind === 'empty' || state.kind === 'error') && (
            <Reveal className="ce-card mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#1F3558]">
                <Icon name={state.kind === 'error' ? 'alert' : 'list'} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[#172033]">
                {state.kind === 'error' ? "We couldn't load tasks right now" : 'No tasks are open right now'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#667085]">
                {state.kind === 'error'
                  ? 'Please try again in a moment, or open the full task list.'
                  : 'New tasks are added over time. Create an account and check back to see what becomes available.'}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Btn href={C.routes.tasks} variant="secondary">Open task list</Btn>
                <Btn href={C.routes.register}>Create Account</Btn>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal className="mt-10 text-center">
          <LandingLink
            href={C.routes.tasks}
            className="group inline-flex items-center gap-2 text-[15px] font-semibold text-[#1F3558] hover:text-[#4F6FAE]"
          >
            View All Available Tasks
            <Icon name="arrow" size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
          </LandingLink>
        </Reveal>
      </Container>
    </section>
  );
}
