import {
	authorizeDelayedPayment,
	fetchFollowUpQueue,
	releaseBooking,
} from "../api";
import type { Booking } from "../types";
import {
	formatCurrency,
	formatDateTime,
	getHoursRemainingBadge,
} from "../utils";
import { showConfirmModal, showPromptModal } from "./MicroModal";
import { openPaymentModal } from "./PaymentModal";
import {
	renderBookingStatusBadge,
	renderCalendarSyncBadge,
	renderPaymentStatusBadge,
} from "./StatusBadge";
import { showToast } from "./Toast";

export function renderFollowUpQueue(
	container: HTMLElement,
	onStateChange: () => void,
): void {
	container.innerHTML = `
		<div class="view-header">
			<div>
				<h2 class="view-title">Cola de Seguimiento (48 Horas)</h2>
				<p class="view-subtitle">Reservaciones pendientes de comprobante de pago próximas a realizarse.</p>
			</div>
			<div class="view-actions">
				<button id="refresh-queue-btn" class="btn btn-secondary btn-sm" title="Refrescar lista">
					↻ Actualizar
				</button>
			</div>
		</div>

		<div id="queue-content" class="queue-container">
			<div class="loading-state">
				<div class="skeleton-card"></div>
				<div class="skeleton-card"></div>
			</div>
		</div>
	`;

	const contentDiv = container.querySelector<HTMLDivElement>("#queue-content");
	const refreshBtn =
		container.querySelector<HTMLButtonElement>("#refresh-queue-btn");

	const loadData = async () => {
		if (!contentDiv) return;
		contentDiv.innerHTML = `
			<div class="loading-state">
				<div class="skeleton-card"></div>
				<div class="skeleton-card"></div>
			</div>
		`;

		try {
			const bookings = await fetchFollowUpQueue();
			renderList(bookings);
		} catch (err: unknown) {
			renderError(err instanceof Error ? err.message : "Error desconocido");
		}
	};

	const renderError = (message: string) => {
		if (!contentDiv) return;
		contentDiv.innerHTML = `
			<div class="card error-state">
				<div class="error-icon">⚠️</div>
				<h3 class="error-title">No se pudo cargar la cola de seguimiento</h3>
				<p class="error-desc">${message}</p>
				<button id="retry-queue-btn" class="btn btn-primary btn-sm">
					Intentar de nuevo
				</button>
			</div>
		`;
		contentDiv
			.querySelector("#retry-queue-btn")
			?.addEventListener("click", () => loadData());
	};

	const renderList = (bookings: Booking[]) => {
		if (!contentDiv) return;

		if (bookings.length === 0) {
			contentDiv.innerHTML = `
				<div class="card empty-state">
					<div class="empty-icon">🌿</div>
					<h3 class="empty-title">Agenda al día</h3>
					<p class="empty-desc">No hay reservaciones pendientes de pago para las próximas 48 horas.</p>
				</div>
			`;
			return;
		}

		contentDiv.innerHTML = `
			<div class="queue-meta">
				<span class="queue-count-pill">${bookings.length} reservación${bookings.length === 1 ? "" : "es"} por atender</span>
			</div>
			<div class="queue-grid">
				${bookings.map((b) => renderCard(b)).join("")}
			</div>
		`;

		attachEvents(bookings);
	};

	const renderCard = (b: Booking): string => {
		const hoursBadge = getHoursRemainingBadge(b.hours_until_session);
		const waLink =
			b.whatsapp_followup_url ||
			`https://wa.me/${b.client_phone?.replace(/\D/g, "") || ""}?text=${encodeURIComponent(
				`Hola ${b.client_name || ""}, te contactamos de Armonía del Ser para dar seguimiento a tu reservación (${b.booking_code}).`,
			)}`;

		return `
			<div class="booking-card" id="card-${b.id}">
				<div class="card-header">
					<div class="header-left">
						<span class="folio-tag">${b.booking_code}</span>
						<span class="${hoursBadge.urgencyClass} text-xs font-semibold px-2 py-0.5 rounded">
							${hoursBadge.text}
						</span>
					</div>
					<div class="header-right">
						${renderBookingStatusBadge(b.booking_status)}
					</div>
				</div>

				<div class="card-body">
					<div class="client-info">
						<h3 class="client-name">${b.client_name || "Cliente sin nombre"}</h3>
						<span class="client-phone">📱 ${b.client_phone || "Sin teléfono"}</span>
					</div>

					<div class="service-details">
						<div class="detail-row">
							<span class="detail-label">Servicio:</span>
							<span class="detail-value font-medium">${b.service_name || "Consulta"}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Fecha y Hora:</span>
							<span class="detail-value font-medium">${formatDateTime(b.scheduled_at)}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Monto:</span>
							<span class="detail-value font-bold text-sage">${formatCurrency(b.amount_mxn)}</span>
						</div>
					</div>

					<div class="status-row">
						${renderPaymentStatusBadge(b.payment_status, b.payment_arrangement)}
						${renderCalendarSyncBadge(b.gcal_sync_status, b.id)}
					</div>
				</div>

				<div class="card-actions">
					<a
						href="${waLink}"
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-whatsapp"
						title="Abrir chat de WhatsApp con recordatorio pre-redactado"
					>
						<span>💬 Enviar WhatsApp</span>
					</a>

					<button
						type="button"
						class="btn btn-primary btn-ack-payment"
						data-booking-id="${b.id}"
					>
						<span>✓ Acreditar Pago</span>
					</button>

					<div class="secondary-actions">
						<button
							type="button"
							class="btn btn-action-delay btn-authorize-delay"
							data-booking-id="${b.id}"
							title="Permitir que el paciente pague al llegar"
						>
							<span>⏳ Prórroga</span>
						</button>
						<button
							type="button"
							class="btn btn-action-release btn-release-slot"
							data-booking-id="${b.id}"
							title="Liberar el espacio si no hubo respuesta"
						>
							<span>✕ Liberar</span>
						</button>
					</div>
				</div>
			</div>
		`;
	};

	const attachEvents = (bookings: Booking[]) => {
		if (!contentDiv) return;

		// Acknowledge payment modal
		contentDiv.querySelectorAll(".btn-ack-payment").forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = btn.getAttribute("data-booking-id");
				const booking = bookings.find((b) => b.id === id);
				if (!booking) return;

				openPaymentModal({
					booking,
					onSuccess: (amount: number) => {
						showToast(
							`Pago acreditado exitosamente (${formatCurrency(amount)})`,
							"success",
							4500,
							{ folio: booking.booking_code },
						);
						loadData();
						onStateChange();
					},
				});
			});
		});

		// Authorize delayed payment
		contentDiv.querySelectorAll(".btn-authorize-delay").forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = btn.getAttribute("data-booking-id");
				const booking = bookings.find((b) => b.id === id);
				if (!id || !booking) return;

				showPromptModal({
					title: "Autorizar Prórroga de Pago",
					kicker: "Excepción Operativa",
					subtitle:
						"Permite al consultante conservar su lugar y liquidar en efectivo o SPEI antes de iniciar su sesión.",
					bookingContext: {
						bookingCode: booking.booking_code,
						clientName: booking.client_name,
						serviceName: booking.service_name,
						scheduledAtFormatted: formatDateTime(booking.scheduled_at),
					},
					label: "Motivo o acuerdo de la prórroga:",
					defaultValue:
						"Acordado con el paciente para pago en efectivo antes de la sesión",
					placeholder:
						"Ej. Confirmado por Jasmin para pago presencial el día de la cita",
					confirmText: "Autorizar Prórroga",
					cancelText: "Cancelar",
					onConfirm: async (notes: string) => {
						await authorizeDelayedPayment(id, notes);
						showToast(
							"Prórroga autorizada. Estado actualizado a Prórroga Autorizada.",
							"warning",
							4500,
							{ folio: booking.booking_code },
						);
						loadData();
						onStateChange();
					},
				});
			});
		});

		// Release booking
		contentDiv.querySelectorAll(".btn-release-slot").forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = btn.getAttribute("data-booking-id");
				const booking = bookings.find((b) => b.id === id);
				if (!id || !booking) return;

				showConfirmModal({
					title: "¿Liberar este horario?",
					kicker: "Liberación de Espacio",
					message: `¿Deseas liberar este horario para otros clientes? Se cancelará la reservación activa y el horario volverá a estar disponible en el calendario público.`,
					bookingContext: {
						bookingCode: booking.booking_code,
						clientName: booking.client_name,
						serviceName: booking.service_name,
						scheduledAtFormatted: formatDateTime(booking.scheduled_at),
					},
					withReasonInput: true,
					reasonLabel: "Motivo de la liberación:",
					defaultReason:
						"Sin respuesta a recordatorios de pago dentro de las 48h",
					reasonPlaceholder:
						"Describe brevemente por qué se libera el horario...",
					confirmText: "Sí, liberar espacio",
					cancelText: "Conservar reservación",
					isDanger: true,
					onConfirm: async (reason: string) => {
						await releaseBooking(id, reason);
						showToast(
							"Espacio liberado con éxito. Horario nuevamente disponible.",
							"info",
							4500,
							{ folio: booking.booking_code },
						);
						loadData();
						onStateChange();
					},
				});
			});
		});
	};

	refreshBtn?.addEventListener("click", () => loadData());
	loadData();
}
