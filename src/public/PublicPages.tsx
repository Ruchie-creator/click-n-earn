import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ChevronDown, Menu, Search, SlidersHorizontal, X } from 'lucide-react'
import { api, type PublicTask } from '../api'
import { formatCurrency } from '../components'
import './landing/landing.css'

function navigate(href: string): void {
  window.dispatchEvent(new CustomEvent('click-earn:navigate', { detail: { href } }))
}

function useSeo(title: string, description: string): void {
  useEffect(() => {
    const oldTitle = document.title
    document.title = title
    const origin = window.location.origin
    const canonicalUrl = `${origin}${window.location.pathname}`
    const touched: Array<{ element: HTMLElement; attribute: string; previous: string | null; created: boolean }> = []
    const setTag = (selector: string, make: () => HTMLElement, attribute: string, value: string) => {
      let element = document.head.querySelector<HTMLElement>(selector)
      const created = !element
      if (!element) {
        element = make()
        document.head.appendChild(element)
      }
      touched.push({ element, attribute, previous: element.getAttribute(attribute), created })
      element.setAttribute(attribute, value)
    }
    const meta = (attribute: 'name' | 'property', name: string, value: string) => setTag(
      `meta[${attribute}="${name}"]`,
      () => {
        const element = document.createElement('meta')
        element.setAttribute(attribute, name)
        return element
      },
      'content',
      value,
    )
    meta('name', 'description', description)
    meta('property', 'og:title', title)
    meta('property', 'og:description', description)
    meta('property', 'og:type', 'website')
    meta('property', 'og:url', canonicalUrl)
    meta('property', 'og:site_name', 'Click & Earn')
    setTag('link[rel="canonical"]', () => {
      const element = document.createElement('link')
      element.setAttribute('rel', 'canonical')
      return element
    }, 'href', canonicalUrl)
    return () => {
      document.title = oldTitle
      touched.forEach(({ element, attribute, previous, created }) => {
        if (created) element.remove()
        else if (previous !== null) element.setAttribute(attribute, previous)
      })
    }
  }, [description, title])
}

export function PublicHeader({ active = 'tasks' }: { active?: 'tasks' | 'how' | 'why' | 'faq' }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const closeAndNavigate = (href: string) => { setOpen(false); navigate(href) }
  const links = [
    { label: 'Available Tasks', href: '/tasks', current: active === 'tasks' },
    { label: 'How It Works', href: '/#how-it-works', current: active === 'how' },
    { label: 'Why Click & Earn', href: '/#why', current: active === 'why' },
    { label: 'FAQ', href: '/#faq', current: active === 'faq' },
  ]
  return <header className="ce-public-header">
    <a className="ce-skip" href="#main">Skip to content</a>
    <div className="ce-public-header-inner">
      <button className="ce-brand" type="button" onClick={() => navigate('/')} aria-label="Click & Earn home"><img src="/brand/logo-wordmark.png" alt="Click & Earn" /></button>
      <nav className="ce-public-nav" aria-label="Primary navigation">{links.map((link) => <button key={link.label} onClick={() => navigate(link.href)} aria-current={link.current ? 'page' : undefined}>{link.label}</button>)}</nav>
      <div className="ce-public-actions"><button className="ce-login-link" onClick={() => navigate('/login')}>Log in</button><button className="ce-public-primary" onClick={() => navigate('/register')}>Create account</button></div>
      <button className="ce-mobile-menu" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
    </div>
    {open && <div className="ce-mobile-sheet"><nav aria-label="Mobile navigation">{links.map((link) => <button key={link.label} onClick={() => closeAndNavigate(link.href)}>{link.label}<ArrowRight size={17} /></button>)}</nav><button className="ce-public-primary w-full" onClick={() => closeAndNavigate('/register')}>Create account</button><button className="ce-mobile-login" onClick={() => closeAndNavigate('/login')}>Log in</button></div>}
  </header>
}

export function PublicFooter() {
  return <footer className="ce-public-footer"><div className="ce-public-container ce-footer-grid"><div><img src="/brand/logo-wordmark.png" alt="Click & Earn" className="ce-footer-logo" /><p>Find tasks, submit proof, and receive your reimbursement plus an incentive after approval.</p></div><nav aria-label="Platform"><strong>Platform</strong><button onClick={() => navigate('/tasks')}>Available Tasks</button><button onClick={() => navigate('/#how-it-works')}>How It Works</button></nav><nav aria-label="Account"><strong>Account</strong><button onClick={() => navigate('/register')}>Create Account</button><button onClick={() => navigate('/login')}>Log In</button></nav><nav aria-label="Legal"><strong>Legal</strong><button onClick={() => navigate('/terms')}>Terms</button><button onClick={() => navigate('/privacy')}>Privacy</button></nav></div><div className="ce-public-container ce-footer-bottom"><span>© {new Date().getFullYear()} Click & Earn. All rights reserved.</span><span>Developed with <span role="img" aria-label="love">❤️</span> by <a href="https://clint-rono.dev" target="_blank" rel="noreferrer">Clint R</a>.</span></div><PublicScrollTop /></footer>
}

function PublicScrollTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const update = () => setVisible(window.scrollY > 420); update(); window.addEventListener('scroll', update, { passive: true }); return () => window.removeEventListener('scroll', update) }, [])
  return <button type="button" className={`ce-public-scroll-top ${visible ? 'is-visible' : ''}`} tabIndex={visible ? 0 : -1} aria-label="Scroll back to top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><ArrowUp size={22} strokeWidth={2.7} /></button>
}

function RewardBreakdown({ task }: { task: PublicTask }) {
  return <dl className="ce-reward-breakdown"><div><dt>Purchase reimbursement</dt><dd>{formatCurrency(task.reimbursement_amount)}</dd></div><div><dt>Incentive</dt><dd className="ce-incentive">+{formatCurrency(task.incentive)}</dd></div><div className="ce-reward-total"><dt>Expected payout</dt><dd>{formatCurrency(task.expected_payout)}</dd></div></dl>
}

function TaskCard({ task }: { task: PublicTask }) {
  return <article className="ce-public-task-card"><div className="ce-task-image">{task.image ? <img src={task.image} alt="" loading="lazy" decoding="async" /> : <span /> }<div><span>{task.category}</span><span className="ce-available-dot">Available</span></div></div><div className="ce-task-card-body"><p className="ce-card-category">{task.category}</p><h2>{task.title}</h2><p>{task.short_description}</p><RewardBreakdown task={task} /><div className="ce-task-card-bottom"><span><b>{task.slots}</b> {task.slots === 1 ? 'slot' : 'slots'} available</span><button onClick={() => navigate(`/tasks/${encodeURIComponent(task.slug)}`)}>View task <ArrowRight size={16} /></button></div></div></article>
}

function TaskSkeleton() { return <div className="ce-public-task-card ce-task-skeleton" aria-hidden="true"><span /><span /><span /><span /></div> }

export function PublicTasksPage() {
  useSeo('Available tasks | Click & Earn', 'Browse available Click & Earn tasks and see the reimbursement, incentive, and expected payout before you begin.')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('newest')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [state, setState] = useState<{ kind: 'loading' | 'error' | 'ready'; tasks: PublicTask[]; total: number; categories: string[] }>({ kind: 'loading', tasks: [], total: 0, categories: [] })

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ per_page: '24' })
      if (query.trim()) params.set('search', query.trim())
      if (category !== 'All') params.set('category', category)
      if (sort !== 'newest') params.set('sort', sort)
      setState((current) => ({ ...current, kind: 'loading' }))
      api.publicTasks(Object.fromEntries(params.entries()), { signal: controller.signal })
        .then((response) => setState({ kind: 'ready', tasks: response.data.items, total: response.data.meta.total, categories: response.data.meta.categories }))
        .catch((error: Error) => { if (error.name !== 'AbortError') setState((current) => ({ ...current, kind: 'error', tasks: [], total: 0 })) })
    }, query ? 200 : 0)
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [category, query, reloadNonce, sort])
  const categories = ['All', ...state.categories]
  return <div className="ce-public-page"><PublicHeader active="tasks" /><main id="main"><section className="ce-marketplace-hero"><div className="ce-public-container ce-marketplace-hero-grid"><div><p className="ce-public-eyebrow">Available tasks</p><h1>Make everyday digital purchases count.</h1><p>Browse tasks with clear rewards, reserve the ones that suit you, then submit proof after completion.</p></div><img src="/public-images/tasks-hero.webp" alt="People collaborating around a laptop" /></div></section><section className="ce-public-container ce-marketplace-content"><div className="ce-filter-panel"><label className="ce-search"><Search size={19} /><span className="sr-only">Search available tasks</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, categories…" /></label><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></label><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="highest_incentive">Highest incentive</option><option value="most_slots">Most slots</option></select><ChevronDown /></label></div><div className="ce-result-row"><p>{state.kind === 'ready' ? <><b>{state.total}</b> {state.total === 1 ? 'task' : 'tasks'} available</> : 'Loading available tasks…'}</p><span><SlidersHorizontal size={15} /> Clear reward terms before you reserve</span></div>{state.kind === 'loading' && <div className="ce-public-task-grid" aria-busy="true">{[1, 2, 3, 4, 5, 6].map((id) => <TaskSkeleton key={id} />)}</div>}{state.kind === 'error' && <div className="ce-public-empty"><h2>We couldn’t load tasks right now.</h2><p>Please check your connection and try again.</p><button className="ce-public-primary" onClick={() => setReloadNonce((current) => current + 1)}>Try again</button></div>}{state.kind === 'ready' && (state.tasks.length ? <div className="ce-public-task-grid">{state.tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div> : <div className="ce-public-empty"><h2>No tasks are open right now.</h2><p>New opportunities are added over time. Create an account and check back.</p><button className="ce-public-primary" onClick={() => navigate('/register')}>Create account</button></div>)}</section></main><PublicFooter /></div>
}

export function PublicTaskDetailPage({ slug, authenticated, onReserve }: { slug: string; authenticated: boolean; onReserve: (taskId: number) => Promise<void> }) {
  const [state, setState] = useState<{ slug: string; kind: 'loading' | 'error' | 'ready'; task?: PublicTask }>({ slug, kind: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    setState({ slug, kind: 'loading' })
    api.publicTask(slug, { signal: controller.signal })
      .then((response) => setState({ slug, kind: 'ready', task: response.data }))
      .catch((error: Error) => { if (error.name !== 'AbortError') setState({ slug, kind: 'error' }) })
    return () => controller.abort()
  }, [slug])
  const currentState = state.slug === slug ? state : { slug, kind: 'loading' as const }
  useSeo(currentState.kind === 'ready' && currentState.task ? `${currentState.task.title} | Click & Earn` : 'Task details | Click & Earn', 'View Click & Earn task details, reward terms, and availability.')
  if (currentState.kind === 'loading') return <div className="ce-public-page"><PublicHeader /><main id="main" className="ce-public-container ce-detail-loading" aria-live="polite">Loading task details…</main></div>
  if (currentState.kind === 'error' || !currentState.task) return <PublicNotFound />
  const task = currentState.task
  const reserve = () => {
    if (authenticated) {
      void onReserve(task.id)
      return
    }
    navigate(`/login?next=${encodeURIComponent(`/tasks/${task.slug}`)}`)
  }
  return <div className="ce-public-page"><PublicHeader active="tasks" /><main id="main" className="ce-detail-page ce-public-container"><button className="ce-back-link" onClick={() => navigate('/tasks')}><ArrowLeft size={17} />All available tasks</button><div className="ce-detail-layout"><article><p className="ce-public-eyebrow">{task.category} · Available</p><h1>{task.title}</h1><p className="ce-detail-summary">{task.short_description}</p><img className="ce-detail-image" src={task.image || '/task-images/business-planning-template.jpg'} alt="" /><section><h2>What to expect</h2><p>Reserve this task from your account. You’ll see the complete instructions and proof requirements only after your reservation is confirmed.</p><ul><li>Review the stated reward before reserving.</li><li>Complete the task through the required purchase flow.</li><li>Submit the requested proof for review.</li></ul></section></article><aside><div className="ce-detail-reward"><p>Reward summary</p><RewardBreakdown task={task} /><p className="ce-detail-slots"><CheckCircle2 size={17} /> {task.slots} {task.slots === 1 ? 'slot' : 'slots'} currently available</p><button className="ce-public-primary w-full" onClick={reserve}>Reserve task <ArrowRight size={17} /></button><small>You’ll need an account to reserve this task. Reward terms are recorded when your reservation is confirmed.</small></div></aside></div></main><PublicFooter /></div>
}

export function PublicLegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const title = type === 'terms' ? 'Terms of use' : 'Privacy'
  const policyName = type === 'terms' ? 'Terms of Use' : 'Privacy Notice'
  useSeo(`${title} | Click & Earn`, `Interim ${title.toLowerCase()} summary for Click & Earn. Full approved policy copy is pending.`)
  return <div className="ce-public-page"><PublicHeader /><main id="main" className="ce-public-container ce-legal"><p className="ce-public-eyebrow">Policy summary · approved copy pending</p><h1>{title}</h1><p className="ce-legal-intro">This is an interim summary, not the complete approved {policyName}.</p><div className="ce-legal-pending" role="note"><strong>Full {policyName} pending approval</strong><p>The full policy has not yet been approved or published. The information below is a brief service summary and is not a substitute for the final policy text.</p></div>{type === 'terms' ? <><h2>Using Click & Earn</h2><p>Click & Earn provides task opportunities with stated reimbursement and incentive terms. A reward is only eligible after the relevant task and proof are reviewed and approved.</p><h2>Task information</h2><p>Instructions and proof requirements are provided to members after reservation. Availability and reward terms can change before a task is reserved.</p></> : <><h2>Information we use</h2><p>We use your account, task, proof, and payout information to provide the service, review submissions, and communicate about your account.</p><h2>Keeping information secure</h2><p>Access to account and proof information is controlled through authenticated application workflows. Do not share your account credentials with anyone.</p></>}<p className="ce-legal-note">For policy questions while the approved copy is pending, contact <a href="mailto:hello@clicknlearn.io">hello@clicknlearn.io</a>.</p></main><PublicFooter /></div>
}

export function PublicNotFound() { useSeo('Page not found | Click & Earn', 'The requested Click & Earn page was not found.'); return <div className="ce-public-page"><PublicHeader /><main id="main" className="ce-public-empty ce-not-found"><p className="ce-public-eyebrow">404</p><h1>That page isn’t here.</h1><p>Try returning home or browse the tasks that are currently available.</p><div><button className="ce-public-primary" onClick={() => navigate('/')}>Back home</button><button className="ce-public-secondary" onClick={() => navigate('/tasks')}>Browse tasks</button></div></main><PublicFooter /></div> }

