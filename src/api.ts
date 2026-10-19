import type {
	Booking,
	PaymentAcknowledgmentPayload,
	PaymentRecord,
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
