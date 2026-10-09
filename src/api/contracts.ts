export type ApiEnvelope<T> = { data: T }

export type ApiDemoStatus = {
  enabled: boolean
  client_preview: boolean
  installed: boolean
  batch_label: string
  counts: {
    users: number
    tasks: number
    reservations: number
    proofs: number
    payouts: number
    ledger_entries: number
    notifications: number
  }
}

export type ApiDemoClearResult = {
  found: boolean
  counts: Record<string, number>
  files_deleted: number
  files_skipped: number
}

export type ApiUser = {
  id: number
  name: string
  email: string
  phone?: string | null
  country?: string | null
  role: 'member' | 'admin' | 'super_admin'
  account_status: string
  referral_code?: string | null
  avatar_url?: string | null
}

export type ApiTask = {
  id: number
  title: string
  short_description: string
  description: string
  category: string
  image?: string | null
  product_price: number
  reimbursement_amount: number
  incentive: number
  expected_payout: number
  slots: number
  available_slots?: number
  reserved_slots?: number
  completed_slots?: number
  status: string
  sponsor?: string
  instructions: string[]
  requirements: string[]
  checkout_url?: string | null
}

export type ApiReservation = {
  id: number
  task_id: number
  task: ApiTask
  reimbursement_amount: number
  incentive_amount: number
  expected_payout: number
  status: string
  status_label: string
  reserved_at?: string | null
  expires_at?: string | null
  submitted_at?: string | null
  latest_proof?: {
    id: number
    version?: number
    original_file_name: string
    purchase_amount?: number
    purchase_date?: string
    purchase_time?: string | null
    transaction_reference?: string | null
    status: string
    user_note?: string | null
    verification?: { confidence_score: number; detected_amount: number | null; warnings: string[] } | null
  } | null
}

export type DashboardData = {
  stats: Record<string, string | number>
  recent_reservations: ApiReservation[]
  notifications_unread: number
}

export type TaskListData = {
  items: ApiTask[]
  meta: { current_page: number; last_page: number; total: number }
}

export type NotificationItem = {
  id: string
  title: string
  body: string
  type?: string
  event_type?: string
  event_key?: string
  task_id?: number
  reservation_id?: number
  proof_submission_id?: number
  payout_id?: number
  referral_id?: number
  read?: boolean
  created_at?: string
}

export type NotificationData = {
  items: NotificationItem[]
  unread_count: number
  meta: { current_page: number; last_page: number; total: number }
}

export type AdminDashboardData = {
  stats: Record<string, string | number>
  queues?: {
    verification?: Array<{ id: number; reference: string; member?: string | null; task?: string | null; amount: number; reimbursement_amount?: number; incentive: number; expected_payout?: number; status?: string; submitted_at?: string | null; confidence?: number | null; file_name?: string | null; warnings?: string[] }>
    payouts?: Array<{ id: number; member?: string | null; task?: string | null; amount: number; reimbursement_amount?: number; incentive_amount?: number; status: string; provider_reference?: string | null }>
  }
}

export type EarningsData = {
  totals: Record<string, string | number>
  items: Array<{ id: number; type: string; amount: number; direction: string; status: string; task?: string | null; created_at?: string | null }>
}

export type PayoutListData = {
  items: Array<ApiPayout>
}

export type ApiPayout = {
  id: number
  amount: number
  reimbursement_amount?: number
  incentive_amount?: number
  currency: string
  status: string
  provider?: string
  provider_reference?: string | null
  paid_at?: string | null
  requested_at?: string | null
}

export type ApiPayoutMethod = {
  id: number
  provider: string
  account_holder_name: string
  account_type: string
  country: string
  currency: string
  masked_account: string
  is_default: boolean
  status: string
}

export type ReferralListData = {
  code: string
  items: Array<{ id: number; name?: string | null; joined_at?: string | null; status: string; reward: number; reward_status: string }>
}
