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
import { openPaymentModal } from "./PaymentModal";
import {
	renderBookingStatusBadge,
	renderCalendarSyncBadge,
	renderPaymentStatusBadge,
} from "./StatusBadge";

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
							class="btn-text btn-authorize-delay"
							data-booking-id="${b.id}"
							title="Permitir que el paciente pague al llegar"
						>
							Autorizar prórroga
						</button>
						<span class="divider">·</span>
						<button
							type="button"
							class="btn-text text-danger btn-release-slot"
							data-booking-id="${b.id}"
							title="Liberar el espacio si no hubo respuesta"
						>
							Liberar lugar
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
					onSuccess: () => {
						loadData();
						onStateChange();
					},
				});
			});
		});

		// Authorize delayed payment
		contentDiv.querySelectorAll(".btn-authorize-delay").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const id = btn.getAttribute("data-booking-id");
				if (!id) return;
				const notes = window.prompt(
					"Motivo o acuerdo de la prórroga de pago:",
					"Acordado con el paciente para pago en efectivo antes de la sesión",
				);
				if (notes === null) return;

				try {
					await authorizeDelayedPayment(id, notes);
					loadData();
					onStateChange();
				} catch (err: unknown) {
					alert(
						err instanceof Error ? err.message : "Error al autorizar prórroga",
					);
				}
			});
		});

		// Release booking
		contentDiv.querySelectorAll(".btn-release-slot").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const id = btn.getAttribute("data-booking-id");
				if (!id) return;
				const reason = window.prompt(
					"¿Deseas liberar este horario para otros clientes? Motivo:",
					"Sin respuesta a recordatorios de pago dentro de las 48h",
				);
				if (reason === null) return;

				try {
					await releaseBooking(id, reason);
					loadData();
					onStateChange();
				} catch (err: unknown) {
					alert(
						err instanceof Error ? err.message : "Error al liberar espacio",
					);
				}
			});
		});
	};

	refreshBtn?.addEventListener("click", () => loadData());
	loadData();
}
