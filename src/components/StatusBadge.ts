import type {
	BookingPaymentStatus,
	BookingStatus,
	GcalSyncStatus,
	PaymentArrangement,
} from "../types";

export function renderBookingStatusBadge(status: BookingStatus): string {
	switch (status) {
		case "RESERVED":
			return '<span class="status-pill status-reserved">Reservada</span>';
		case "COMPLETED":
			return '<span class="status-pill status-completed">Completada</span>';
		case "CANCELLED":
			return '<span class="status-pill status-cancelled">Cancelada</span>';
		case "RELEASED":
			return '<span class="status-pill status-released">Espacio Liberado</span>';
		case "NO_SHOW":
			return '<span class="status-pill status-noshow">No asistió</span>';
		default:
			return `<span class="status-pill">${status}</span>`;
	}
}

export function renderPaymentStatusBadge(
	paymentStatus: BookingPaymentStatus,
	arrangement: PaymentArrangement,
): string {
	if (arrangement === "PACKAGE_REDEEMED") {
		return '<span class="status-pill status-package">Sesión de Paquete</span>';
	}

	if (paymentStatus === "ACKNOWLEDGED") {
		return '<span class="status-pill status-acknowledged">✓ Pago Confirmado</span>';
	}

	if (arrangement === "DELAYED_ALLOWED") {
		return '<span class="status-pill status-delayed">⏳ Prórroga Autorizada</span>';
	}

	return '<span class="status-pill status-awaiting">⚠️ Pago Pendiente</span>';
}

export function renderCalendarSyncBadge(
	syncStatus: GcalSyncStatus,
	bookingId: string,
): string {
	switch (syncStatus) {
		case "SYNCED":
			return '<span class="status-pill status-gcal-synced" title="Sincronizado con Google Calendar">📅 En Google Calendar</span>';
		case "FAILED":
			return `
				<div class="inline-flex items-center gap-1">
					<span class="status-pill status-gcal-failed" title="Fallo en la sincronización">⚠️ Error Cal</span>
					<button class="btn-xs btn-retry-gcal" data-booking-id="${bookingId}" title="Reintentar sincronización con Google Calendar">↻</button>
				</div>
			`;
		case "PENDING":
			return '<span class="status-pill status-gcal-pending">⏳ Sincronizando...</span>';
		default:
			return '<span class="status-pill status-gcal-none">Cal no config</span>';
	}
}
