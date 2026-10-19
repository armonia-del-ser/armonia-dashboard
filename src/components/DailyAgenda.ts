import {
	completeBooking,
	fetchAllBookings,
	rescheduleBooking,
	retryCalendarSync,
} from "../api";
import type { Booking } from "../types";
import {
	calculateInterval,
	checkBufferCollision,
	formatCurrency,
	formatDateInput,
	formatDateTime,
	formatTimeOnly,
	isSameDay,
	isThisWeek,
	isToday,
	isTomorrow,
} from "../utils";
import { showConfirmModal } from "./MicroModal";
import {
	renderBookingStatusBadge,
	renderCalendarSyncBadge,
	renderPaymentStatusBadge,
} from "./StatusBadge";
import { showToast } from "./Toast";

type AgendaDateFilter = "TODAY" | "TOMORROW" | "THIS_WEEK" | "ALL" | "CUSTOM";

export function renderDailyAgenda(
	container: HTMLElement,
	onStateChange: () => void,
): void {
	let activeFilter: AgendaDateFilter = "TODAY";
	let customDateStr: string = "";
	let cachedBookings: Booking[] = [];

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

		<!-- Date Navigation & Filter Bar -->
		<div class="agenda-nav-bar">
			<div class="date-filter-group" role="tablist" aria-label="Filtro de fecha para la agenda">
				<button type="button" class="btn btn-filter-pill active" data-filter="TODAY" role="tab" aria-selected="true">
					Hoy
				</button>
				<button type="button" class="btn btn-filter-pill" data-filter="TOMORROW" role="tab" aria-selected="false">
					Mañana
				</button>
				<button type="button" class="btn btn-filter-pill" data-filter="THIS_WEEK" role="tab" aria-selected="false">
					Esta Semana
				</button>
				<button type="button" class="btn btn-filter-pill" data-filter="ALL" role="tab" aria-selected="false">
					Todas
				</button>
			</div>

			<div class="custom-date-container">
				<label for="agenda-custom-date" class="date-picker-label">Día específico:</label>
				<input
					type="date"
					id="agenda-custom-date"
					class="form-input-date"
					title="Elegir una fecha específica"
					aria-label="Seleccionar fecha específica en calendario"
				/>
			</div>
		</div>

		<div id="agenda-filter-indicator" class="filter-indicator-banner"></div>

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
	const indicatorDiv = container.querySelector<HTMLDivElement>(
		"#agenda-filter-indicator",
	);
	const refreshBtn = container.querySelector<HTMLButtonElement>(
		"#refresh-agenda-btn",
	);
	const customDateInput = container.querySelector<HTMLInputElement>(
		"#agenda-custom-date",
	);
	const filterButtons =
		container.querySelectorAll<HTMLButtonElement>(".btn-filter-pill");

	const loadData = async () => {
		if (!contentDiv) return;
		contentDiv.innerHTML = `
			<div class="loading-state">
				<div class="skeleton-card"></div>
			</div>
		`;

		try {
			const bookings = await fetchAllBookings();
			cachedBookings = bookings
				.filter(
					(b) =>
						b.booking_status !== "CANCELLED" && b.booking_status !== "RELEASED",
				)
				.sort(
					(a, b) =>
						new Date(a.scheduled_at).getTime() -
						new Date(b.scheduled_at).getTime(),
				);

			applyFilter();
		} catch (err: unknown) {
			if (contentDiv) {
				contentDiv.innerHTML = `
					<div class="card error-state">
						<div class="error-icon">⚠️</div>
						<h3 class="error-title">Error al cargar la agenda</h3>
						<p class="error-desc">${err instanceof Error ? err.message : "Error desconocido"}</p>
						<button id="retry-agenda-load" class="btn btn-primary btn-sm">Reintentar</button>
					</div>
				`;
				contentDiv
					.querySelector("#retry-agenda-load")
					?.addEventListener("click", () => loadData());
			}
		}
	};

	const filterBookings = (): Booking[] => {
		const now = new Date();

		if (activeFilter === "TODAY") {
			return cachedBookings.filter((b) =>
				isToday(new Date(b.scheduled_at), now),
			);
		}
		if (activeFilter === "TOMORROW") {
			return cachedBookings.filter((b) =>
				isTomorrow(new Date(b.scheduled_at), now),
			);
		}
		if (activeFilter === "THIS_WEEK") {
			return cachedBookings.filter((b) =>
				isThisWeek(new Date(b.scheduled_at), now),
			);
		}
		if (activeFilter === "CUSTOM" && customDateStr) {
			const [year, month, day] = customDateStr.split("-").map(Number);
			const targetDate = new Date(year, month - 1, day);
			return cachedBookings.filter((b) =>
				isSameDay(new Date(b.scheduled_at), targetDate),
			);
		}
		return cachedBookings;
	};

	const updateIndicator = (filteredCount: number) => {
		if (!indicatorDiv) return;
		let label = "";
		if (activeFilter === "TODAY") {
			label = `📅 Mostrando citas para: <strong>Hoy</strong> (${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date())})`;
		} else if (activeFilter === "TOMORROW") {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			label = `📅 Mostrando citas para: <strong>Mañana</strong> (${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(tomorrow)})`;
		} else if (activeFilter === "THIS_WEEK") {
			label = `📅 Mostrando citas para: <strong>Esta Semana</strong>`;
		} else if (activeFilter === "CUSTOM" && customDateStr) {
			const [year, month, day] = customDateStr.split("-").map(Number);
			const targetDate = new Date(year, month - 1, day);
			label = `📅 Mostrando citas para el día: <strong>${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(targetDate)}</strong>`;
		} else {
			label = "📅 Mostrando: <strong>Todas las citas programadas</strong>";
		}

		indicatorDiv.innerHTML = `
			<span>${label}</span>
			<span class="indicator-count">${filteredCount} ${filteredCount === 1 ? "cita activa" : "citas activas"}</span>
		`;
	};

	const applyFilter = () => {
		const filtered = filterBookings();
		updateIndicator(filtered.length);
		renderStats(filtered);
		renderTimeline(filtered);
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
				<span class="stat-label">Citas en Periodo</span>
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
					<h3 class="empty-title">Agenda libre en este periodo</h3>
					<p class="empty-desc">No hay citas activas programadas para el filtro seleccionado. Puedes cambiar de fecha o ver "Todas las Citas".</p>
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
							const collision = checkBufferCollision(
								b.scheduled_at,
								b.duration_minutes || 60,
								b.buffer_minutes || 15,
								nextBooking.scheduled_at,
							);

							if (collision.hasCollision) {
								const nextStartStr = formatTimeOnly(nextBooking.scheduled_at);
								collisionNotice = `
									<div class="collision-alert ${collision.isDirectCollision ? "collision-critical" : "collision-warning"}" role="alert">
										<div class="collision-header">
											<span class="collision-icon">${collision.isDirectCollision ? "🛑" : "⚠️"}</span>
											<span class="collision-title font-bold">
												${collision.isDirectCollision ? "Colisión Directa entre Sesiones" : "Conflicto de Buffer Protegido"}
											</span>
											<span class="collision-deficit-pill">-${collision.deficitMinutes} min de holgura</span>
										</div>
										<div class="collision-markers">
											<div class="marker-chip">
												<span class="marker-chip-label">Término cita actual:</span>
												<span class="marker-chip-time font-mono">${interval.endStr}</span>
											</div>
											<div class="marker-chip marker-buffer">
												<span class="marker-chip-label">Buffer requerido hasta:</span>
												<span class="marker-chip-time font-mono">${interval.bufferEndStr}</span>
											</div>
											<div class="marker-chip marker-conflict">
												<span class="marker-chip-label">Inicio siguiente (${nextBooking.booking_code}):</span>
												<span class="marker-chip-time font-mono font-bold">${nextStartStr}</span>
											</div>
										</div>
										<p class="collision-explainer">
											${
												collision.isDirectCollision
													? `La cita <strong>${nextBooking.booking_code}</strong> inicia antes del término de la sesión actual.`
													: `La cita <strong>${nextBooking.booking_code}</strong> invade el buffer de 15 minutos de descanso y preparación.`
											}
										</p>
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

									${
										b.booking_status === "RESERVED"
											? `
										<div class="agenda-card-actions">
											<button
												type="button"
												class="btn btn-secondary btn-sm btn-reschedule-booking"
												data-booking-id="${b.id}"
												title="Mover cita a otro horario o día"
											>
												<span>🗓️ Mover Cita</span>
											</button>
											<button
												type="button"
												class="btn btn-outline-success btn-sm btn-complete-booking"
												data-booking-id="${b.id}"
												title="Marcar consulta como concluida"
											>
												<span>✓ Concluir Cita</span>
											</button>
										</div>
									`
											: ""
									}

									${collisionNotice}
								</div>
							</div>
						`;
					})
					.join("")}
			</div>
		`;

		// Attach 'Mover Cita' handlers
		contentDiv.querySelectorAll(".btn-reschedule-booking").forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = btn.getAttribute("data-booking-id");
				const booking = bookings.find((b) => b.id === id);
				if (!booking) return;

				openRescheduleModal({
					booking,
					onSuccess: (updated) => {
						showToast(
							`Cita reagendada para ${formatDateTime(updated.scheduled_at)}`,
							"success",
							5000,
							{ folio: updated.booking_code },
						);
						loadData();
						onStateChange();
					},
				});
			});
		});

		// Attach 'Concluir Cita' handlers
		contentDiv.querySelectorAll(".btn-complete-booking").forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = btn.getAttribute("data-booking-id");
				const booking = bookings.find((b) => b.id === id);
				if (!booking) return;

				showConfirmModal({
					title: "¿Concluir consulta?",
					kicker: "Finalización de Sesión",
					message: `¿Deseas marcar la consulta de <strong>${booking.client_name || "Cliente"}</strong> (${booking.booking_code}) como concluida? Se registrará la asistencia y el estado cambiará a CONCLUIDA.`,
					bookingContext: {
						bookingCode: booking.booking_code,
						clientName: booking.client_name,
						serviceName: booking.service_name,
						scheduledAtFormatted: formatDateTime(booking.scheduled_at),
					},
					withReasonInput: true,
					reasonLabel:
						"Notas clínicas u observaciones de la sesión (opcional):",
					defaultReason: "",
					reasonPlaceholder:
						"Ej. Se completó terapia de sonido; paciente reporta relajación profunda.",
					confirmText: "✓ Sí, Concluir Cita",
					cancelText: "Volver",
					isDanger: false,
					onConfirm: async (notes) => {
						await completeBooking(booking.id, {
							notes: notes || undefined,
						});
						showToast(
							`Cita ${booking.booking_code} marcada como Concluida`,
							"success",
							5000,
							{ folio: booking.booking_code },
						);
						loadData();
						onStateChange();
					},
				});
			});
		});

		// Attach retry calendar sync buttons
		contentDiv.querySelectorAll(".btn-retry-gcal").forEach((btn) => {
			btn.addEventListener("click", async () => {
				const id = btn.getAttribute("data-booking-id");
				if (!id) return;
				const origText = btn.textContent;
				btn.textContent = "⏳...";
				try {
					await retryCalendarSync(id);
					showToast(
						"✓ Sincronización exitosa con Google Calendar",
						"success",
						4000,
					);
					loadData();
					onStateChange();
				} catch (err: unknown) {
					showToast(
						err instanceof Error
							? err.message
							: "Error al reintentar sincronización",
						"error",
						5000,
					);
					btn.textContent = origText;
				}
			});
		});
	};

	// Event Handlers for Filter Buttons
	filterButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			const filter = btn.getAttribute("data-filter") as AgendaDateFilter;
			if (!filter) return;

			activeFilter = filter;
			if (customDateInput) customDateInput.value = "";
			customDateStr = "";

			filterButtons.forEach((b) => {
				const isCurrent = b === btn;
				b.classList.toggle("active", isCurrent);
				b.setAttribute("aria-selected", isCurrent ? "true" : "false");
			});

			applyFilter();
		});
	});

	// Event Handler for Custom Date Input
	customDateInput?.addEventListener("change", () => {
		if (customDateInput.value) {
			activeFilter = "CUSTOM";
			customDateStr = customDateInput.value;

			filterButtons.forEach((b) => {
				b.classList.remove("active");
				b.setAttribute("aria-selected", "false");
			});

			applyFilter();
		}
	});

	refreshBtn?.addEventListener("click", () => loadData());
	loadData();
}

interface RescheduleModalOptions {
	booking: Booking;
	onSuccess: (updated: Booking) => void;
}

function openRescheduleModal(options: RescheduleModalOptions): void {
	const { booking, onSuccess } = options;
	const existing = document.getElementById("reschedule-modal-backdrop");
	if (existing) existing.remove();

	const backdrop = document.createElement("div");
	backdrop.id = "reschedule-modal-backdrop";
	backdrop.className = "modal-backdrop";

	const currentDt = new Date(booking.scheduled_at);
	const defaultDate = formatDateInput(currentDt);
	const hours = String(currentDt.getHours()).padStart(2, "0");
	const mins = String(currentDt.getMinutes()).padStart(2, "0");
	const defaultTime = `${hours}:${mins}`;

	backdrop.innerHTML = `
		<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reschedule-modal-title">
			<div class="modal-header">
				<div>
					<span class="modal-kicker">Reagendación de Consulta</span>
					<h3 id="reschedule-modal-title" class="modal-title">Mover Cita</h3>
				</div>
				<button type="button" class="modal-close-btn" id="reschedule-modal-close" aria-label="Cerrar modal">&times;</button>
			</div>

			<div class="modal-body">
				<div class="summary-box">
					<div class="summary-row">
						<span class="summary-label">Folio:</span>
						<span class="summary-value font-mono font-bold">${booking.booking_code}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Paciente:</span>
						<span class="summary-value font-semibold">${booking.client_name || "Cliente"}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Servicio:</span>
						<span class="summary-value">${booking.service_name || "Consulta"}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Horario actual:</span>
						<span class="summary-value font-medium">${formatDateTime(booking.scheduled_at)}</span>
					</div>
				</div>

				<form id="reschedule-form" class="modal-form-content mt-3">
					<div class="form-group">
						<label class="form-label font-semibold">Nuevo Horario Propuesto:</label>
						<div class="datetime-grid">
							<div class="form-subgroup">
								<label for="reschedule-date" class="form-sublabel">Nueva Fecha:</label>
								<input
									type="date"
									id="reschedule-date"
									class="form-input"
									value="${defaultDate}"
									required
								/>
							</div>
							<div class="form-subgroup">
								<label for="reschedule-time" class="form-sublabel">Nueva Hora:</label>
								<input
									type="time"
									id="reschedule-time"
									class="form-input"
									value="${defaultTime}"
									step="900"
									required
								/>
							</div>
						</div>
					</div>

					<div class="form-group">
						<label for="reschedule-notes" class="form-label font-semibold">
							Motivo de Reagendación (opcional):
						</label>
						<textarea
							id="reschedule-notes"
							class="form-textarea"
							rows="2"
							placeholder="Ej. Solicitado por el consultante..."
						></textarea>
					</div>

					<div id="reschedule-error" class="modal-error-box hidden" role="alert"></div>

					<div class="modal-actions">
						<button type="button" id="reschedule-cancel-btn" class="btn btn-secondary">
							Cancelar
						</button>
						<button type="submit" id="reschedule-submit-btn" class="btn btn-primary">
							Confirmar Nuevo Horario
						</button>
					</div>
				</form>
			</div>
		</div>
	`;

	document.body.appendChild(backdrop);

	const close = () => {
		backdrop.remove();
		document.removeEventListener("keydown", handleKeyDown);
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") close();
	};
	document.addEventListener("keydown", handleKeyDown);

	backdrop
		.querySelector("#reschedule-modal-close")
		?.addEventListener("click", () => close());
	backdrop
		.querySelector("#reschedule-cancel-btn")
		?.addEventListener("click", () => close());
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) close();
	});

	const form = backdrop.querySelector<HTMLFormElement>("#reschedule-form");
	const dateInput =
		backdrop.querySelector<HTMLInputElement>("#reschedule-date");
	const timeInput =
		backdrop.querySelector<HTMLInputElement>("#reschedule-time");
	const notesInput =
		backdrop.querySelector<HTMLTextAreaElement>("#reschedule-notes");
	const submitBtn = backdrop.querySelector<HTMLButtonElement>(
		"#reschedule-submit-btn",
	);
	const errorBox = backdrop.querySelector<HTMLDivElement>("#reschedule-error");

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!submitBtn || !errorBox) return;

		const dVal = dateInput?.value;
		const tVal = timeInput?.value;
		const notes = notesInput?.value.trim() || undefined;

		if (!dVal || !tVal) {
			errorBox.textContent = "Por favor selecciona la nueva fecha y hora.";
			errorBox.classList.remove("hidden");
			return;
		}

		const newDt = new Date(`${dVal}T${tVal}:00`);
		if (Number.isNaN(newDt.getTime())) {
			errorBox.textContent = "Fecha u hora inválida.";
			errorBox.classList.remove("hidden");
			return;
		}

		submitBtn.disabled = true;
		submitBtn.textContent = "Reagendando...";
		errorBox.classList.add("hidden");

		try {
			const updated = await rescheduleBooking(booking.id, {
				new_scheduled_at: newDt.toISOString(),
				notes,
			});
			close();
			onSuccess(updated);
		} catch (err: unknown) {
			submitBtn.disabled = false;
			submitBtn.textContent = "Confirmar Nuevo Horario";
			errorBox.textContent =
				err instanceof Error ? err.message : "Error al reagendar la consulta.";
			errorBox.classList.remove("hidden");
		}
	});
}
