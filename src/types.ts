export type BookingStatus =
	| "RESERVED"
	| "RELEASED"
	| "CANCELLED"
	| "COMPLETED"
	| "NO_SHOW";

export type PaymentArrangement =
	| "PREPAID_DEFAULT"
	| "DELAYED_ALLOWED"
	| "PACKAGE_REDEEMED";

export type PaymentStatus =
	| "AWAITING_ACKNOWLEDGMENT"
	| "ACKNOWLEDGED"
	| "NOT_APPLICABLE";

export type BookingPaymentStatus = PaymentStatus;

export type GcalSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "NOT_CONFIGURED";

export interface Booking {
	id: string;
	booking_code: string;
	service_id: string;
	service_name: string | null;
	client_id: string;
	client_name: string | null;
	client_phone: string | null;
	package_id: string | null;
	scheduled_at: string;
	duration_minutes: number;
	buffer_minutes: number;
	booking_status: BookingStatus;
	payment_arrangement: PaymentArrangement;
	payment_status: PaymentStatus;
	amount_mxn: number;
	needs_payment_followup: boolean;
	hours_until_session: number;
	exception_authorized_by?: string | null;
	exception_authorized_at?: string | null;
	exception_notes?: string | null;
	released_by?: string | null;
	released_at?: string | null;
	release_reason?: string | null;
	acknowledged_by?: string | null;
	acknowledged_at?: string | null;
	gcal_event_id?: string | null;
	gcal_sync_status: GcalSyncStatus;
	gcal_sync_error?: string | null;
	gcal_synced_at?: string | null;
	created_at: string;
	whatsapp_redirect_url?: string | null;
	whatsapp_followup_url?: string | null;
}

export interface PaymentAcknowledgmentPayload {
	booking_id: string;
	amount_mxn: number;
	payment_method: "SPEI" | "OXXO" | "CASH";
	notes?: string | null;
}

export interface PaymentRecord {
	id: string;
	booking_id: string;
	amount_mxn: number;
	payment_method: "SPEI" | "OXXO" | "CASH";
	status: "ACKNOWLEDGED" | "REVERSED";
	acknowledged_by: string;
	acknowledged_at: string;
	notes?: string | null;
	created_at: string;
}

export type AdminRole = "OWNER" | "ASSISTANT";

export interface AdminPrincipal {
	email: string;
	full_name: string;
	role: AdminRole;
	is_active: boolean;
	last_login_at?: string | null;
}

export type ServiceType = "INDIVIDUAL" | "GROUP";
export type ServiceModality = "PRESENCIAL" | "ONLINE";

export interface Service {
	id: string;
	slug: string;
	name: string;
	description?: string | null;
	service_type: ServiceType;
	modality: ServiceModality;
	default_schedule?: string | null;
	price_mxn: number;
	max_capacity: number;
	duration_minutes: number;
	buffer_minutes: number;
	is_active: boolean;
}

export interface Client {
	id: string;
	full_name: string;
	phone_whatsapp: string;
	email?: string | null;
	notes?: string | null;
	created_at: string;
}

export interface ClientUpdatePayload {
	full_name?: string;
	phone_whatsapp?: string;
	email?: string | null;
	notes?: string | null;
}

export interface PackageRecord {
	id: string;
	client_id: string;
	client_name?: string | null;
	client_phone?: string | null;
	service_id: string;
	service_name?: string | null;
	total_sessions: number;
	completed_sessions: number;
	remaining_sessions: number;
	price_paid_mxn: number;
	financial_status: "PAID" | "PARTIAL" | "PENDING";
	notes?: string | null;
	created_at: string;
	updated_at: string;
}

export interface Client360 extends Client {
	active_packages: PackageRecord[];
	booking_history: Booking[];
	recent_bookings: Booking[];
}

export interface BookingCreatePayload {
	service_id: string;
	client_name: string;
	client_phone: string;
	client_email?: string | null;
	scheduled_at: string;
	notes?: string | null;
	package_id?: string | null;
}

export interface BookingReschedulePayload {
	new_scheduled_at: string;
	notes?: string | null;
}

export interface BookingCompletePayload {
	package_id?: string | null;
	notes?: string | null;
}
