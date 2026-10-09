import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'
type ToastItem = { id: number; message: string; kind: ToastKind }
type OperationOptions = { title: string; description: string; successMessage: string; successDescription?: string }
type FeedbackDialog = {
  mode: 'operation' | 'loading'
  phase: 'processing' | 'success' | 'error'
  title: string
  description: string
  successMessage?: string
  errorMessage?: string
  progress?: number | null
  retry?: () => Promise<void>
}
type FeedbackContextValue = {
  notify: (message: string, kind?: ToastKind) => void
  runOperation: (options: OperationOptions, action: () => Promise<unknown>) => Promise<boolean>
  runLoading: (title: string, description: string, action: () => Promise<unknown>) => Promise<boolean>
  updateProgress: (progress: number | null) => void
  processing: boolean
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider.')
  return value
}

function friendlyError(error: unknown): string {
  if (error instanceof TypeError) return 'We could not reach the server. Check your connection and try again.'
  const message = error instanceof Error ? error.message : ''
  if (!message || /sql|stack trace|exception|internal server|secret|token|password|database|\.php\b/i.test(message)) {
    return 'We could not complete that request. Please try again.'
  }
  return message.length > 220 ? 'We could not complete that request. Please try again.' : message
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<FeedbackDialog | null>(null)
  const [processing, setProcessing] = useState(false)
  const activeRef = useRef(false)
  const nextToastId = useRef(1)
  const toastTimers = useRef(new Map<number, number>())
  const dialogTimer = useRef<number | null>(null)

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    toastTimers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const trimmed = message.trim()
    if (!trimmed) return
    const id = nextToastId.current++
    setToasts((current) => {
      if (current.some((item) => item.message === trimmed && item.kind === kind)) return current
      return [...current, { id, message: trimmed, kind }].slice(-4)
    })
    if (kind !== 'error') {
      const duration = kind === 'warning' ? 6500 : 4200
      const timer = window.setTimeout(() => dismissToast(id), duration)
      toastTimers.current.set(id, timer)
    }
  }, [dismissToast])

  const finishDialog = useCallback(() => {
    if (dialogTimer.current !== null) window.clearTimeout(dialogTimer.current)
    dialogTimer.current = null
    setDialog(null)
    activeRef.current = false
    setProcessing(false)
  }, [])

  const updateProgress = useCallback((progress: number | null) => {
    setDialog((current) => current?.mode === 'operation' && current.phase === 'processing'
      ? { ...current, progress }
      : current)
  }, [])

  const runOperation = useCallback(async (options: OperationOptions, action: () => Promise<unknown>): Promise<boolean> => {
    if (activeRef.current) return false
    activeRef.current = true
    setProcessing(true)
    if (dialogTimer.current !== null) window.clearTimeout(dialogTimer.current)
    const execute = async (): Promise<void> => {
      setDialog({ mode: 'operation', phase: 'processing', title: options.title, description: options.description, retry: execute })
      try {
        await action()
        setDialog({ mode: 'operation', phase: 'success', title: options.successMessage, description: options.successDescription || 'Your changes have been saved.', successMessage: options.successMessage })
        notify(options.successMessage, 'success')
        dialogTimer.current = window.setTimeout(finishDialog, 2000)
      } catch (error) {
        activeRef.current = false
        setProcessing(false)
        setDialog({ mode: 'operation', phase: 'error', title: options.title, description: friendlyError(error), errorMessage: friendlyError(error), retry: execute })
      }
    }
    await execute()
    return true
  }, [finishDialog, notify])

  const runLoading = useCallback(async (title: string, description: string, action: () => Promise<unknown>): Promise<boolean> => {
    if (activeRef.current) return false
    activeRef.current = true
    setProcessing(true)
    let shown = false
    const retry = async (): Promise<void> => {
      activeRef.current = true
      setProcessing(true)
      setDialog({ mode: 'loading', phase: 'processing', title, description, retry })
      try {
        await action()
        setDialog(null)
      } catch (error) {
        const message = friendlyError(error)
        activeRef.current = false
        setDialog({ mode: 'loading', phase: 'error', title, description: message, errorMessage: message, retry })
      } finally {
        activeRef.current = false
        setProcessing(false)
      }
    }
    const showTimer = window.setTimeout(() => {
      shown = true
      setDialog({ mode: 'loading', phase: 'processing', title, description, retry })
    }, 300)
    try {
      await action()
      window.clearTimeout(showTimer)
      if (shown) setDialog(null)
      activeRef.current = false
      setProcessing(false)
      return true
    } catch (error) {
      window.clearTimeout(showTimer)
      activeRef.current = false
      setProcessing(false)
      const message = friendlyError(error)
      setDialog({ mode: 'loading', phase: 'error', title, description: message, errorMessage: message, retry })
      return false
    }
  }, [])

  useEffect(() => () => {
    toastTimers.current.forEach((timer) => window.clearTimeout(timer))
    if (dialogTimer.current !== null) window.clearTimeout(dialogTimer.current)
  }, [])

  return <FeedbackContext.Provider value={{ notify, runOperation, runLoading, updateProgress, processing }}>
    {children}
    <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    {dialog && <OperationDialog dialog={dialog} onClose={finishDialog} />}
  </FeedbackContext.Provider>
}

function ToastRegion({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return <div className="toast-region" aria-live="polite" aria-relevant="additions removals">
    {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />)}
  </div>
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertCircle : Info
  return <div className={`toast-card toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
    <span className="toast-icon"><Icon size={17} /></span>
    <p className="min-w-0 flex-1 text-sm font-medium leading-5">{toast.message}</p>
    <button type="button" onClick={onDismiss} className="toast-dismiss" aria-label="Dismiss notification"><X size={16} /></button>
  </div>
}

function OperationDialog({ dialog, onClose }: { dialog: FeedbackDialog; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    panel?.focus()
    return () => previousFocus.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialog.phase === 'error') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
        if (!focusable?.length) {
          event.preventDefault()
          panelRef.current?.focus()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog.phase, onClose])

  const isError = dialog.phase === 'error'
  const Icon = dialog.phase === 'success' ? CheckCircle2 : dialog.phase === 'error' ? AlertCircle : null
  return <div className="operation-backdrop">
    <section ref={panelRef} className={`operation-panel ${dialog.phase === 'success' ? 'operation-success' : ''}`} role="dialog" aria-modal="true" aria-labelledby="operation-title" aria-describedby="operation-description" tabIndex={-1}>
      <div className={`operation-mark operation-mark-${dialog.phase}`}>
        {Icon ? <Icon size={25} strokeWidth={1.9} /> : <LoaderCircle className="operation-spinner" size={25} strokeWidth={2} />}
      </div>
      <p className="operation-eyebrow">{dialog.mode === 'loading' ? 'Workspace update' : dialog.phase === 'processing' ? 'Secure operation' : dialog.phase === 'success' ? 'Completed' : 'Action needed'}</p>
      <h2 id="operation-title" className="operation-title">{dialog.title}</h2>
      <p id="operation-description" className="operation-description">{dialog.description}</p>
      {isError && <div className="operation-error" role="alert">{dialog.errorMessage}</div>}
      {isError && <div className="mt-5 flex flex-col-reverse justify-center gap-2 sm:flex-row">
        {dialog.retry && <button type="button" onClick={() => void dialog.retry?.()} className="btn-primary"><LoaderCircle size={15} /> Try again</button>}
        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
      </div>}
      {dialog.phase === 'processing' && dialog.progress !== undefined && dialog.progress !== null
        ? <div className="operation-progress operation-progress-determinate" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dialog.progress}><span style={{ width: `${Math.max(0, Math.min(100, dialog.progress))}%` }} /></div>
        : dialog.phase === 'processing' && <div className="operation-progress" aria-hidden="true"><span /></div>}
      {dialog.phase === 'processing' && dialog.progress !== undefined && dialog.progress !== null && <p className="mt-2 text-[11px] font-medium tabular-nums text-muted">{dialog.progress}% uploaded</p>}
    </section>
  </div>
}
