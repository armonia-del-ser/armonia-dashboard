import { getCleanDigitsPhone } from "../utils";

/**
 * Format workshop session capacity label according to spec AC-1:
 * "Ocupación: {occupied_count} / {max_capacity} ({attended_count} presentes)"
 */
export function formatRosterCapacity(
	occupiedCount: number,
	maxCapacity: number,
	attendedCount: number,
): string {
	return `Ocupación: ${occupiedCount} / ${maxCapacity} (${attendedCount} presentes)`;
}

/**
 * Render attendance status pill according to section 2.2:
 * REGISTRADO (Slate/Neutral) vs ASISTIÓ (Emerald/Green)
 */
export function renderAttendanceStatusBadge(
	attended: boolean,
	bookingStatus?: string,
): string {
	if (attended || bookingStatus === "COMPLETED") {
		return '<span class="status-pill status-roster-attended">ASISTIÓ</span>';
	}
	return '<span class="status-pill status-roster-registered">REGISTRADO</span>';
}

/**
 * Render payment status pill according to section 2.2:
 * PAGADO (Emerald/Green) vs PENDIENTE (Amber/Orange)
 */
export function renderPaymentStatusPill(paymentStatus: string): string {
	if (paymentStatus === "ACKNOWLEDGED") {
		return '<span class="status-pill status-roster-paid">PAGADO</span>';
	}
	return '<span class="status-pill status-roster-pending">PENDIENTE</span>';
}

/**
 * Build 1-tap WhatsApp click-to-chat URL
 */
export function buildWhatsAppUrl(phone: string): string {
	const clean = getCleanDigitsPhone(phone);
	return `https://wa.me/${clean}`;
}

export type ConflictType =
	| "ALREADY_CHECKED_IN"
	| "CAPACITY_EXCEEDED"
	| "UNKNOWN";

/**
 * Disambiguate HTTP 409 Conflict based on response detail
 */
export function disambiguate409Error(detail?: string): ConflictType {
	if (!detail) return "UNKNOWN";
	const lower = detail.toLowerCase();
	if (lower.includes("already checked in")) {
		return "ALREADY_CHECKED_IN";
	}
	if (lower.includes("cupo máximo") || lower.includes("cupo maximo")) {
		return "CAPACITY_EXCEEDED";
	}
	return "UNKNOWN";
}
