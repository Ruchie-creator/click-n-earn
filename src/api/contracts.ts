export type ApiEnvelope<T> = { data: T };

export type ApiDemoStatus = {
  enabled: boolean;
  client_preview: boolean;
  installed: boolean;
  batch_label: string;
  counts: {
    users: number;
    tasks: number;
    reservations: number;
    proofs: number;
    payouts: number;
    ledger_entries: number;
    notifications: number;
  };
};

export type ApiDemoClearResult = {
  found: boolean;
  counts: Record<string, number>;
  files_deleted: number;
  files_skipped: number;
};

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  role: "member" | "admin" | "super_admin";
  account_status: string;
  email_verified_at?: string | null;
  referral_code?: string | null;
  avatar_url?: string | null;
  email_verified: boolean;
  payout_verification_status:
    | "not_submitted"
    | "pending_review"
    | "approved"
    | "changes_requested"
    | "rejected"
    | string;
  payout_masked_account?: string | null;
  duplicate_review_required: boolean;
  bank_account_required_for_tasks: boolean;
  eligible_to_reserve: boolean;
  eligibility_next_step?: string | null;
  eligibility_message?: string | null;
};

export type ApiTask = {
  id: number;
  title: string;
  short_description: string;
  description: string;
  category: string;
  image?: string | null;
  product_price: number;
  reimbursement_amount: number;
  incentive: number;
  expected_payout: number;
  slots: number;
  available_slots?: number;
  reserved_slots?: number;
  completed_slots?: number;
  status: string;
  availability_status?: "available" | "purchased" | "unavailable";
  sponsor?: string;
  instructions: string[];
  requirements: string[];
  checkout_url?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
};

export type ApiAdminTaskDetail = {
  task: ApiTask;
  metrics: {
    reservations: number;
    submissions: number;
    approved: number;
    paid: number;
    submission_rate: number;
    approval_rate: number;
    committed_value: number;
    paid_value: number;
  };
  funnel: Array<{ label: string; value: number }>;
  trend: Array<{ date: string; reservations: number; submissions: number }>;
  recent_activity: Array<{
    id: number;
    member: string;
    email?: string | null;
    status: string;
    amount: number;
    reserved_at?: string | null;
    submitted_at?: string | null;
  }>;
};

export type ApiReservation = {
  id: number;
  task_id: number;
  task: ApiTask;
  reimbursement_amount: number;
  incentive_amount: number;
  expected_payout: number;
  status: string;
  status_label: string;
  reserved_at?: string | null;
  expires_at?: string | null;
  submitted_at?: string | null;
  latest_proof?: {
    id: number;
    version?: number;
    original_file_name: string;
    purchase_amount?: number;
    purchase_date?: string;
    purchase_time?: string | null;
    transaction_reference?: string | null;
    status: string;
    user_note?: string | null;
    verification?: {
      confidence_score: number;
      detected_amount: number | null;
      warnings: string[];
    } | null;
  } | null;
};

export type DashboardData = {
  stats: Record<string, string | number>;
  recent_reservations: ApiReservation[];
  notifications_unread: number;
};

export type TaskListData = {
  items: ApiTask[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    categories?: string[];
  };
};

export type PublicTask = {
  id: number;
  slug: string;
  title: string;
  short_description: string;
  category: string;
  image?: string | null;
  reimbursement_amount: number;
  incentive: number;
  expected_payout: number;
  slots: number;
  status: "available";
};

export type PublicTaskListData = {
  items: PublicTask[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    categories: string[];
  };
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type?: string;
  event_type?: string;
  event_key?: string;
  task_id?: number;
  reservation_id?: number;
  proof_submission_id?: number;
  payout_id?: number;
  referral_id?: number;
  read?: boolean;
  created_at?: string;
};

export type NotificationData = {
  items: NotificationItem[];
  unread_count: number;
  meta: { current_page: number; last_page: number; total: number };
};

export type AdminDashboardData = {
  stats: Record<string, string | number>;
  queues?: {
    verification?: Array<{
      id: number;
      reference: string;
      member?: string | null;
      task?: string | null;
      amount: number;
      reimbursement_amount?: number;
      incentive: number;
      expected_payout?: number;
      status?: string;
      submitted_at?: string | null;
      confidence?: number | null;
      file_name?: string | null;
      warnings?: string[];
    }>;
    payouts?: Array<{
      id: number;
      member?: string | null;
      task?: string | null;
      amount: number;
      reimbursement_amount?: number;
      incentive_amount?: number;
      status: string;
      provider_reference?: string | null;
    }>;
  };
};

export type EarningsData = {
  totals: Record<string, string | number>;
  items: Array<{
    id: number;
    type: string;
    amount: number;
    direction: string;
    status: string;
    task?: string | null;
    created_at?: string | null;
  }>;
};

export type PayoutListData = {
  items: Array<ApiPayout>;
};

export type ApiPayout = {
  id: number;
  amount: number;
  reimbursement_amount?: number;
  incentive_amount?: number;
  currency: string;
  status: string;
  provider?: string;
  provider_reference?: string | null;
  paid_at?: string | null;
  requested_at?: string | null;
  provider_environment?: "sandbox" | "live";
};

export type ApiPayoutMethod = {
  id: number;
  account_holder_name: string;
  account_type: string;
  entity_type: "PERSONAL" | "COMPANY";
  transfer_method: "LOCAL" | "SWIFT";
  country: string;
  currency: string;
  masked_account: string;
  is_default: boolean;
  status: string;
  verification_status: string;
  verification_reason?: string | null;
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  duplicate_review_required: boolean;
};

export type ApiFaq = {
  id: number;
  category?: string | null;
  question: string;
  answer: string;
  is_published?: boolean;
  sort_order?: number;
  updated_at?: string;
};
export type ApiTaskCategory = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  archived_at?: string | null;
  task_count: number;
};
export type ApiPayoutVerification = {
  id: number;
  member?: string | null;
  email?: string | null;
  user_id: number;
  account_holder_name: string;
  entity_type: string;
  transfer_method: string;
  country: string;
  currency: string;
  masked_account: string;
  status: string;
  verification_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  duplicate_review_required: boolean;
  duplicate_resolution_note?: string | null;
  bank_details?: {
    account_holder_name: string;
    account_type?: string | null;
    entity_type: string;
    transfer_method: string;
    country: string;
    currency: string;
    account_details: Record<string, unknown>;
    routing_details: Record<string, unknown>;
    beneficiary_address: Record<string, unknown>;
  };
  duplicate_matches?: Array<{
    id: number;
    member?: string | null;
    email?: string | null;
    masked_account: string;
    status: string;
    submitted_at?: string | null;
  }>;
  history?: Array<{
    id: number;
    action: string;
    from_status?: string | null;
    to_status: string;
    reason?: string | null;
    actor?: string | null;
    created_at: string;
  }>;
};

export type ApiBeneficiarySchema = {
  fields: Array<{
    key: string;
    path: string;
    required: boolean;
    rule?: { type?: string; pattern?: string };
    field?: {
      default?: string;
      description?: string;
      example?: string;
      label?: string;
      placeholder?: string;
      refresh?: boolean;
      tip?: string;
      type?:
        "INPUT" | "SELECT" | "DYNAMIC_SELECT" | "RADIO" | "TRANSFER_METHOD";
      options?: Array<{ label: string; value: string; description?: string }>;
    };
  }>;
};

export type ApiBeneficiaryCountries = { countries: string[] };

export type ReferralListData = {
  code: string;
  page_description?: string | null;
  reward_amount?: number | null;
  items: Array<{
    id: number;
    name?: string | null;
    joined_at?: string | null;
    status: string;
    reward: number;
    reward_status: string;
    qualification_status?: string;
    task?: string | null;
    qualifying_purchase?: {
      task?: string | null;
      purchase_amount: number;
      approved_at?: string | null;
    } | null;
    payout_status?: string | null;
    paid_at?: string | null;
  }>;
  qualified_count?: number;
  pending_count?: number;
};
