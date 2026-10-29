import type {
	AdminPrincipal,
	Booking,
	BookingCompletePayload,
	BookingCreatePayload,
	BookingReschedulePayload,
	Client,
	Client360,
	ClientUpdatePayload,
	PackageRecord,
	PaymentAcknowledgmentPayload,
	PaymentRecord,
	QuickCheckinPayload,
	QuickCheckinResponse,
	RosterSession,
	Service,
} from "./types";

const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const ADMIN_API_KEY =
	import.meta.env.VITE_ADMIN_API_KEY || "dev-secret-key-change-in-production";
const ADMIN_EMAIL = "jasmin@armoniadelser.mx";

function getAuthHeaders(): HeadersInit {
	return {
		"Content-Type": "application/json",
		"X-Admin-Key": ADMIN_API_KEY,
		"X-Admin-Email": ADMIN_EMAIL,
	};
}

export async function fetchFollowUpQueue(): Promise<Booking[]> {
	const res = await fetch(`${API_BASE_URL}/bookings/follow-up-queue`, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		throw new Error(
			`Error al obtener cola de seguimiento: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function fetchAllBookings(params?: {
	date?: string;
	booking_status?: string;
	payment_status?: string;
}): Promise<Booking[]> {
	const query = new URLSearchParams();
	if (params?.date) query.set("date", params.date);
	if (params?.booking_status)
		query.set("booking_status", params.booking_status);
	if (params?.payment_status)
		query.set("payment_status", params.payment_status);

	const url = `${API_BASE_URL}/bookings${query.toString() ? `?${query.toString()}` : ""}`;
	const res = await fetch(url, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		throw new Error(
			`Error al obtener reservaciones: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function acknowledgePayment(
	payload: PaymentAcknowledgmentPayload,
): Promise<PaymentRecord> {
	const res = await fetch(`${API_BASE_URL}/payments/acknowledge`, {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al acreditar pago: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function authorizeDelayedPayment(
	bookingId: string,
	notes?: string,
): Promise<Booking> {
	const res = await fetch(
		`${API_BASE_URL}/bookings/${bookingId}/authorize-delayed-payment`,
		{
			method: "POST",
			headers: getAuthHeaders(),
			body: JSON.stringify({ notes }),
		},
	);
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al autorizar prórroga: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function releaseBooking(
	bookingId: string,
	reason?: string,
): Promise<Booking> {
	const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/release`, {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify({ reason }),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al liberar espacio: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function retryCalendarSync(bookingId: string): Promise<Booking> {
	const res = await fetch(
		`${API_BASE_URL}/bookings/${bookingId}/sync-calendar`,
		{
			method: "POST",
			headers: getAuthHeaders(),
		},
	);
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al sincronizar calendario: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function fetchCurrentAdmin(): Promise<AdminPrincipal> {
	const res = await fetch(`${API_BASE_URL}/auth/me`, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al consultar identidad de operador: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function fetchServices(activeOnly = true): Promise<Service[]> {
	const res = await fetch(
		`${API_BASE_URL}/services?active_only=${activeOnly ? "true" : "false"}`,
		{
			headers: getAuthHeaders(),
		},
	);
	if (!res.ok) {
		throw new Error(
			`Error al obtener catálogo de servicios: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function searchClients(search?: string): Promise<Client[]> {
	const query = search ? `?search=${encodeURIComponent(search.trim())}` : "";
	const res = await fetch(`${API_BASE_URL}/clients${query}`, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		throw new Error(
			`Error al buscar clientes: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function fetchClient360(clientId: string): Promise<Client360> {
	const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al obtener perfil de cliente: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function updateClient(
	clientId: string,
	payload: ClientUpdatePayload,
): Promise<Client> {
	const res = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
		method: "PATCH",
		headers: getAuthHeaders(),
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al actualizar datos de cliente: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function createBooking(
	payload: BookingCreatePayload,
): Promise<Booking> {
	const res = await fetch(`${API_BASE_URL}/bookings`, {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al agendar cita: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function rescheduleBooking(
	bookingId: string,
	payload: BookingReschedulePayload,
): Promise<Booking> {
	const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/reschedule`, {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al reagendar cita: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function completeBooking(
	bookingId: string,
	payload?: BookingCompletePayload,
): Promise<Booking> {
	const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/complete`, {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(payload || {}),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		throw new Error(
			errData.detail ||
				`Error al concluir cita: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export async function fetchPackages(
	clientId?: string,
): Promise<PackageRecord[]> {
	const query = clientId ? `?client_id=${encodeURIComponent(clientId)}` : "";
	const res = await fetch(`${API_BASE_URL}/packages${query}`, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		throw new Error(
			`Error al obtener paquetes: ${res.status} ${res.statusText}`,
		);
	}
	return res.json();
}

export class ApiError extends Error {
	public status: number;
	public detail?: string;

	constructor(status: number, message: string, detail?: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.detail = detail;
	}
}

export async function fetchRosters(params: {
	date_from: string;
	date_to: string;
	service_id?: string;
}): Promise<RosterSession[]> {
	const query = new URLSearchParams();
	query.set("date_from", params.date_from);
	query.set("date_to", params.date_to);
	if (params.service_id) query.set("service_id", params.service_id);

	const url = `${API_BASE_URL}/rosters?${query.toString()}`;
	const res = await fetch(url, {
		headers: getAuthHeaders(),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		const detail = errData.detail || `${res.status} ${res.statusText}`;
		throw new ApiError(
			res.status,
			`Error al obtener talleres: ${detail}`,
			errData.detail,
		);
	}
	return res.json();
}

export async function quickCheckin(
	payload: QuickCheckinPayload,
): Promise<QuickCheckinResponse> {
	const res = await fetch(`${API_BASE_URL}/rosters/quick-checkin`, {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const errData = await res.json().catch(() => ({}));
		const detail = errData.detail || `${res.status} ${res.statusText}`;
		throw new ApiError(
			res.status,
			`Error al registrar asistencia: ${detail}`,
			errData.detail,
		);
	}
	return res.json();
}
