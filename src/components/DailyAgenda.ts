import { fetchAllBookings, retryCalendarSync } from "../api";
import type { Booking } from "../types";
import { calculateInterval, formatCurrency, formatDateTime } from "../utils";
import {
	renderBookingStatusBadge,
	renderCalendarSyncBadge,
	renderPaymentStatusBadge,
} from "./StatusBadge";

export function renderDailyAgenda(
	container: HTMLElement,
	onStateChange: () => void,
): void {
	container.innerHTML = `
		<div class="view-header">
			<div>
				<h2 class="view-title">Agenda & Control de Capacidad</h2>
				<p class="view-subtitle">Visualización cronológica con protección de buffers de 15 min entre pacientes.</p>
			</div>
			<div class="view-actions">
				<button id="refresh-agenda-btn" class="btn btn-secondary btn-sm" title="Refrescar agenda">
					↻ Actualizar
				</button>
			</div>
		</div>

		<div id="agenda-stats" class="stats-row"></div>

		<div id="agenda-content" class="agenda-timeline">
			<div class="loading-state">
				<div class="skeleton-card"></div>
				<div class="skeleton-card"></div>
			</div>
		</div>
	`;

	const contentDiv = container.querySelector<HTMLDivElement>("#agenda-content");
	const statsDiv = container.querySelector<HTMLDivElement>("#agenda-stats");
	const refreshBtn = container.querySelector<HTMLButtonElement>(
		"#refresh-agenda-btn",
	);

	const loadData = async () => {
		if (!contentDiv) return;
		contentDiv.innerHTML = `
			<div class="loading-state">
				<div class="skeleton-card"></div>
			</div>
		`;

		try {
			const bookings = await fetchAllBookings();
			// Filter active bookings and sort chronologically
			const activeBookings = bookings
				.filter(
					(b) =>
						b.booking_status !== "CANCELLED" && b.booking_status !== "RELEASED",
				)
				.sort(
					(a, b) =>
						new Date(a.scheduled_at).getTime() -
						new Date(b.scheduled_at).getTime(),
				);

			renderStats(activeBookings);
			renderTimeline(activeBookings);
		} catch (err: unknown) {
			if (contentDiv) {
				contentDiv.innerHTML = `
					<div class="card error-state">
						<div class="error-icon">⚠️</div>
						<h3 class="error-title">Error al cargar la agenda</h3>
						<p class="error-desc">${err instanceof Error ? err.message : "Error desconocido"}</p>
					</div>
				`;
			}
		}
	};

	const renderStats = (bookings: Booking[]) => {
		if (!statsDiv) return;
		const total = bookings.length;
		const confirmed = bookings.filter(
			(b) => b.payment_status === "ACKNOWLEDGED",
		).length;
		const pending = bookings.filter(
			(b) => b.payment_status === "AWAITING_ACKNOWLEDGMENT",
		).length;
		const totalMinutes = bookings.reduce(
			(acc, b) => acc + (b.duration_minutes || 60) + (b.buffer_minutes || 15),
			0,
		);
		const totalHours = (totalMinutes / 60).toFixed(1);

		statsDiv.innerHTML = `
			<div class="stat-card">
				<span class="stat-label">Citas Programadas</span>
				<span class="stat-number">${total}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Pagos Confirmados</span>
				<span class="stat-number text-success">${confirmed}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Pendientes / Prórroga</span>
				<span class="stat-number text-warning">${pending}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Tiempo Ocupado + Buffer</span>
				<span class="stat-number">${totalHours}h</span>
			</div>
		`;
	};

	const renderTimeline = (bookings: Booking[]) => {
		if (!contentDiv) return;

		if (bookings.length === 0) {
			contentDiv.innerHTML = `
				<div class="card empty-state">
					<div class="empty-icon">📅</div>
					<h3 class="empty-title">Agenda libre</h3>
					<p class="empty-desc">No hay citas activas programadas en este momento.</p>
				</div>
			`;
			return;
		}

		contentDiv.innerHTML = `
			<div class="timeline-list">
				${bookings
					.map((b, idx) => {
						const interval = calculateInterval(
							b.scheduled_at,
							b.duration_minutes || 60,
							b.buffer_minutes || 15,
						);

						// Collision detector with subsequent session
						let collisionNotice = "";
						if (idx < bookings.length - 1) {
							const nextBooking = bookings[idx + 1];
							const nextStart = new Date(nextBooking.scheduled_at);
							if (nextStart < interval.bufferEnd) {
								collisionNotice = `
									<div class="collision-alert">
										⚠️ ADVERTENCIA: La siguiente cita (${nextBooking.booking_code}) inicia a las ${interval.endStr}, invadiendo el buffer de preparación.
									</div>
								`;
							}
						}

						return `
							<div class="timeline-item">
								<div class="timeline-time-col">
									<span class="time-main">${interval.startStr}</span>
									<span class="time-end">a ${interval.endStr}</span>
									<span class="duration-badge">${b.duration_minutes || 60} min</span>
								</div>

								<div class="timeline-card">
									<div class="card-header">
										<div class="header-left">
											<span class="folio-tag">${b.booking_code}</span>
											<span class="service-name-inline font-medium">${b.service_name || "Consulta"}</span>
										</div>
										<div class="header-right">
											${renderBookingStatusBadge(b.booking_status)}
										</div>
									</div>

									<div class="card-body-compact">
										<div class="client-row">
											<span class="client-name font-semibold">${b.client_name || "Cliente"}</span>
											<span class="client-phone text-muted">📱 ${b.client_phone || ""}</span>
										</div>
										<div class="meta-row">
											<span class="date-text">${formatDateTime(b.scheduled_at)}</span>
											<span class="amount-tag font-bold">${formatCurrency(b.amount_mxn)}</span>
										</div>
										<div class="status-chips">
											${renderPaymentStatusBadge(b.payment_status, b.payment_arrangement)}
											${renderCalendarSyncBadge(b.gcal_sync_status, b.id)}
										</div>
									</div>

									<!-- Mandatory Buffer Block -->
									<div class="buffer-block" title="Intervalo de buffer protegido para evitar retrasos en cascada">
										<div class="buffer-badge">
											🌿 Buffer de descanso y preparación (${b.buffer_minutes || 15} min): 
											<strong>${interval.endStr} - ${interval.bufferEndStr}</strong>
										</div>
										<span class="buffer-hint">Tiempo no agendable protegido por el backend.</span>
									</div>

									${collisionNotice}
								</div>
							</div>
						`;
					})
					.join("")}
			</div>
		`;

		// Attach retry calendar sync buttons
		contentDiv.querySelectorAll(".btn-retry-gcal").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const id = btn.getAttribute("data-booking-id");
				if (!id) return;
				btn.textContent = "⏳...";
				try {
					await retryCalendarSync(id);
					loadData();
					onStateChange();
				} catch (err: unknown) {
					alert(
						err instanceof Error ? err.message : "Error al reintentar sync",
					);
					btn.textContent = "↻";
				}
			});
		});
	};

	refreshBtn?.addEventListener("click", () => loadData());
	loadData();
}
