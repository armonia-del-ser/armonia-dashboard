import { ApiError, fetchRosters, quickCheckin } from "../api";
import type {
	QuickCheckinBookingPayload,
	QuickCheckinWalkInPayload,
	RosterAttendee,
	RosterSession,
} from "../types";
import { formatMexicanPhone, getCleanDigitsPhone } from "../utils";
import { showToast } from "./Toast";

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

/**
 * Format ISO datetime to 24-hour time in Mexico City timezone (e.g. 18:00)
 */
export function formatRosterSessionTime(isoStr: string): string {
	try {
		const dt = new Date(isoStr);
		if (Number.isNaN(dt.getTime())) return isoStr;
		return new Intl.DateTimeFormat("es-MX", {
			timeZone: "America/Mexico_City",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(dt);
	} catch {
		return isoStr;
	}
}

/**
 * Helper to get today's date formatted as YYYY-MM-DD in Mexico City timezone
 */
export function getTodayDateString(): string {
	try {
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: "America/Mexico_City",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		return formatter.format(new Date());
	} catch {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	}
}

export type ConflictType =
	| "ALREADY_CHECKED_IN"
	| "CAPACITY_EXCEEDED"
	| "UNKNOWN";

/**
 * Escape HTML characters to prevent XSS in template string interpolations
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Reconcile session state upon out-of-band 409 ALREADY_CHECKED_IN conflict.
 * Ensures attendance status is COMPLETED / ASISTIÓ, and if the attendee was
 * previously unrecorded locally, increments attended_count.
 * Returns true if attended_count was incremented.
 */
export function reconcileAlreadyCheckedInState(
	session: RosterSession,
	attendee: RosterAttendee,
): boolean {
	const wasAttended =
		attendee.attended || attendee.booking_status === "COMPLETED";
	attendee.attended = true;
	attendee.booking_status = "COMPLETED";
	if (!wasAttended) {
		session.attended_count += 1;
		return true;
	}
	return false;
}

/**
 * Reconcile local session state with authoritative server sessions.
 * Matches sessions by service_id and scheduled_at to update counts and attendee records.
 */
export function reconcileSessionsWithServer(
	currentSessions: RosterSession[],
	freshSessions: RosterSession[],
): RosterSession[] {
	if (!freshSessions || freshSessions.length === 0) {
		return currentSessions;
	}
	return freshSessions.map((fresh) => {
		const existing = currentSessions.find(
			(curr) =>
				curr.service_id === fresh.service_id &&
				curr.scheduled_at === fresh.scheduled_at,
		);
		if (!existing) return fresh;
		return {
			...existing,
			...fresh,
			attendees: fresh.attendees.map((freshAtt) => {
				const existingAtt = existing.attendees.find(
					(a) => a.booking_id === freshAtt.booking_id,
				);
				return {
					...existingAtt,
					...freshAtt,
				};
			}),
		};
	});
}

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

/**
 * Main component renderer for the Group Workshop Roster view (#rosters)
 */
export function renderWorkshopRoster(
	container: HTMLElement,
	onStateChange?: () => void,
): void {
	let selectedDate = getTodayDateString();
	let cachedSessions: RosterSession[] = [];

	container.innerHTML = `
		<div class="view-header">
			<div>
				<h2 class="view-title">Talleres Grupales & Control de Asistencia</h2>
				<p class="view-subtitle">Pase de lista digital, cobro en puerta y registro de asistentes sin cita.</p>
			</div>
			<div class="view-actions">
				<button id="refresh-roster-btn" class="btn btn-secondary btn-sm" title="Refrescar lista de talleres" type="button">
					↻ Actualizar
				</button>
			</div>
		</div>

		<!-- Date Navigation & Filter Bar -->
		<div class="roster-nav-bar">
			<div class="date-filter-group" role="tablist" aria-label="Filtro rápido de fecha">
				<button type="button" class="btn btn-filter-pill active" id="roster-btn-today" role="tab" aria-selected="true">
					Hoy
				</button>
				<button type="button" class="btn btn-filter-pill" id="roster-btn-tomorrow" role="tab" aria-selected="false">
					Mañana
				</button>
			</div>
			<div class="custom-date-container">
				<label for="roster-date-input" class="text-xs text-muted font-medium">Fecha:</label>
				<input
					type="date"
					id="roster-date-input"
					class="form-input-date"
					value="${escapeHtml(selectedDate)}"
					aria-label="Seleccionar fecha de talleres"
				/>
			</div>
		</div>

		<!-- Main Dynamic Content Container -->
		<div id="roster-content" class="roster-content-area" aria-live="polite"></div>
	`;

	const contentEl = container.querySelector<HTMLElement>("#roster-content");
	const dateInput =
		container.querySelector<HTMLInputElement>("#roster-date-input");
	const btnToday =
		container.querySelector<HTMLButtonElement>("#roster-btn-today");
	const btnTomorrow = container.querySelector<HTMLButtonElement>(
		"#roster-btn-tomorrow",
	);
	const btnRefresh = container.querySelector<HTMLButtonElement>(
		"#refresh-roster-btn",
	);

	function updateDateFilterPills(dateStr: string) {
		const today = getTodayDateString();
		const tomorrow = (() => {
			const d = new Date(`${today}T12:00:00`);
			d.setDate(d.getDate() + 1);
			return d.toISOString().slice(0, 10);
		})();

		const isTodayActive = dateStr === today;
		const isTomorrowActive = dateStr === tomorrow;

		btnToday?.classList.toggle("active", isTodayActive);
		btnToday?.setAttribute("aria-selected", isTodayActive ? "true" : "false");

		btnTomorrow?.classList.toggle("active", isTomorrowActive);
		btnTomorrow?.setAttribute(
			"aria-selected",
			isTomorrowActive ? "true" : "false",
		);

		if (dateInput) {
			dateInput.value = dateStr;
		}
	}

	async function loadSessions(): Promise<void> {
		if (!contentEl) return;

		// 1. Loading State: Skeleton cards preventing layout shift
		renderLoadingSkeleton(contentEl);

		try {
			const sessions = await fetchRosters({
				date_from: selectedDate,
				date_to: selectedDate,
			});
			cachedSessions = sessions;

			// 2. Empty State
			if (sessions.length === 0) {
				renderEmptyState(contentEl, selectedDate);
				return;
			}

			// 3. Success / Ready State
			renderSessions(contentEl, cachedSessions);
		} catch (err: unknown) {
			// 4. Failed Roster Retrieval State with Actionable Retry
			renderErrorState(contentEl, err);
		}
	}

	function renderLoadingSkeleton(target: HTMLElement): void {
		target.innerHTML = `
			<div class="roster-skeleton-wrapper" aria-busy="true" aria-label="Cargando talleres...">
				<div class="roster-session-card skeleton-card">
					<div class="skeleton-line skeleton-title"></div>
					<div class="skeleton-line skeleton-meta"></div>
					<div class="skeleton-table">
						<div class="skeleton-line skeleton-row"></div>
						<div class="skeleton-line skeleton-row"></div>
						<div class="skeleton-line skeleton-row"></div>
					</div>
				</div>
			</div>
		`;
	}

	function renderEmptyState(target: HTMLElement, dateStr: string): void {
		target.innerHTML = `
			<div class="empty-state roster-empty-state">
				<div class="empty-icon" aria-hidden="true">🪷</div>
				<h3 class="empty-title">Sin talleres programados</h3>
				<p class="empty-message">No hay talleres grupales programados para esta fecha.</p>
				<p class="text-xs text-muted mt-2">Fecha seleccionada: ${escapeHtml(dateStr)}. Navega a otra fecha para consultar talleres.</p>
			</div>
		`;
	}

	function renderErrorState(target: HTMLElement, _error: unknown): void {
		target.innerHTML = `
			<div class="error-state roster-error-state" role="alert">
				<div class="error-box-card">
					<div class="error-icon" aria-hidden="true">⚠️</div>
					<div class="error-content">
						<h3 class="font-bold text-base">Error al consultar los talleres</h3>
						<p class="error-banner-message">No se pudieron cargar los talleres. Verifica tu conexión.</p>
					</div>
					<button type="button" id="roster-retry-btn" class="btn btn-secondary">
						Reintentar
					</button>
				</div>
			</div>
		`;

		const retryBtn =
			target.querySelector<HTMLButtonElement>("#roster-retry-btn");
		retryBtn?.addEventListener("click", () => {
			loadSessions();
		});
	}

	function renderSessions(
		target: HTMLElement,
		sessions: RosterSession[],
	): void {
		target.innerHTML = "";

		sessions.forEach((session, sessionIdx) => {
			const card = document.createElement("div");
			card.className = "roster-session-card";
			card.setAttribute("data-session-idx", String(sessionIdx));

			const timeStr = formatRosterSessionTime(session.scheduled_at);
			const capacityText = formatRosterCapacity(
				session.occupied_count,
				session.max_capacity,
				session.attended_count,
			);

			card.innerHTML = `
				<div class="session-card-header">
					<div class="session-title-block">
						<span class="session-time-pill" title="Horario del taller">⏰ ${escapeHtml(timeStr)} hrs</span>
						<h3 class="session-title">${escapeHtml(session.service_name)}</h3>
					</div>
					<div class="session-header-actions">
						<span class="session-capacity-counter font-mono font-medium" id="capacity-counter-${sessionIdx}">
							${capacityText}
						</span>
						<button
							type="button"
							class="btn btn-primary btn-sm btn-walkin"
							data-session-idx="${sessionIdx}"
							title="Registrar participante sin reservación previa"
						>
							＋ Registrar Asistente Sin Cita
						</button>
					</div>
				</div>

				<div class="session-attendees-container" id="attendees-container-${sessionIdx}">
					${renderAttendeesList(session, sessionIdx)}
				</div>
			`;

			target.appendChild(card);
		});

		bindSessionCardEvents(target);
	}

	function renderAttendeesList(
		session: RosterSession,
		sessionIdx: number,
	): string {
		if (session.attendees.length === 0) {
			return `
				<div class="attendees-empty-notice">
					<p class="text-sm text-muted">Aún no hay asistentes registrados para esta sesión.</p>
				</div>
			`;
		}

		const rowsHtml = session.attendees
			.map((attendee, attIdx) => {
				const isAttended =
					attendee.attended || attendee.booking_status === "COMPLETED";
				const waUrl = buildWhatsAppUrl(attendee.client_phone);
				const formattedPhone = formatMexicanPhone(attendee.client_phone);
				const cleanPhoneDigits = getCleanDigitsPhone(attendee.client_phone);

				const attendanceBadge = renderAttendanceStatusBadge(
					isAttended,
					attendee.booking_status,
				);
				const paymentBadge = renderPaymentStatusPill(attendee.payment_status);

				let actionHtml = "";
				if (isAttended) {
					actionHtml = `
						<button type="button" class="btn btn-secondary btn-sm btn-checkin" disabled aria-disabled="true">
							✓ Asistió
						</button>
					`;
				} else if (attendee.payment_status === "AWAITING_ACKNOWLEDGMENT") {
					actionHtml = `
						<div class="checkin-action-group">
							<label class="cash-toggle-label" for="cash-check-${sessionIdx}-${attIdx}">
								<input
									type="checkbox"
									id="cash-check-${sessionIdx}-${attIdx}"
									class="cash-checkbox"
									data-booking-id="${escapeHtml(attendee.booking_id)}"
								/>
								<span class="text-xs">Cobro en efectivo recibido</span>
							</label>
							<button
								type="button"
								class="btn btn-primary btn-sm btn-checkin"
								data-session-idx="${sessionIdx}"
								data-att-idx="${attIdx}"
								data-booking-id="${escapeHtml(attendee.booking_id)}"
							>
								Registrar Asistencia
							</button>
						</div>
					`;
				} else {
					// Pre-paid attendee (ACKNOWLEDGED)
					actionHtml = `
						<div class="checkin-action-group">
							<button
								type="button"
								class="btn btn-primary btn-sm btn-checkin"
								data-session-idx="${sessionIdx}"
								data-att-idx="${attIdx}"
								data-booking-id="${escapeHtml(attendee.booking_id)}"
							>
								Registrar Asistencia
							</button>
						</div>
					`;
				}

				return `
					<div class="roster-attendee-row ${isAttended ? "row-attended" : ""}" data-booking-id="${escapeHtml(attendee.booking_id)}">
						<div class="attendee-col-client">
							<span class="attendee-name font-medium">${escapeHtml(attendee.client_name)}</span>
							<span class="attendee-code font-mono">${escapeHtml(attendee.booking_code)}</span>
						</div>

						<div class="attendee-col-phone">
							<span class="attendee-phone-text">${escapeHtml(formattedPhone)}</span>
							<a
								href="${escapeHtml(waUrl)}"
								target="_blank"
								rel="noopener noreferrer"
								class="btn-wa-link"
								title="Abrir chat en WhatsApp"
								aria-label="Contactar a ${escapeHtml(attendee.client_name)} por WhatsApp"
							>
								<span class="wa-icon" aria-hidden="true">💬</span>
								<span class="wa-label font-mono text-xs">wa.me/${escapeHtml(cleanPhoneDigits)}</span>
							</a>
						</div>

						<div class="attendee-col-badges">
							<div class="badge-slot-attendance">${attendanceBadge}</div>
							<div class="badge-slot-payment">${paymentBadge}</div>
						</div>

						<div class="attendee-col-actions">
							${actionHtml}
						</div>
					</div>
				`;
			})
			.join("");

		return `<div class="roster-attendees-table">${rowsHtml}</div>`;
	}

	function bindSessionCardEvents(target: HTMLElement): void {
		// 1. Walk-in registration trigger
		const walkinButtons =
			target.querySelectorAll<HTMLButtonElement>(".btn-walkin");
		walkinButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const sessionIdx = Number(btn.getAttribute("data-session-idx"));
				const session = cachedSessions[sessionIdx];
				if (session) {
					openWalkInModal(session, sessionIdx);
				}
			});
		});

		// 2. Quick Check-in trigger for existing attendees
		const checkinButtons = target.querySelectorAll<HTMLButtonElement>(
			".btn-checkin:not([disabled])",
		);
		checkinButtons.forEach((btn) => {
			btn.addEventListener("click", async () => {
				const sessionIdx = Number(btn.getAttribute("data-session-idx"));
				const attIdx = Number(btn.getAttribute("data-att-idx"));
				const bookingId = btn.getAttribute("data-booking-id");
				if (!bookingId) return;

				const session = cachedSessions[sessionIdx];
				const attendee = session?.attendees[attIdx];
				if (!session || !attendee) return;

				// Determine if cash was checked
				const rowEl = btn.closest(".roster-attendee-row");
				const cashCheckbox =
					rowEl?.querySelector<HTMLInputElement>(".cash-checkbox");
				const isCashChecked = cashCheckbox?.checked ?? false;

				await handleExistingCheckin({
					button: btn,
					rowEl: rowEl as HTMLElement,
					session,
					sessionIdx,
					attendee,
					paidCash: isCashChecked,
				});
			});
		});
	}

	async function handleExistingCheckin(params: {
		button: HTMLButtonElement;
		rowEl: HTMLElement | null;
		session: RosterSession;
		sessionIdx: number;
		attendee: RosterAttendee;
		paidCash: boolean;
	}): Promise<void> {
		const { button, rowEl, session, sessionIdx, attendee, paidCash } = params;

		// Disable button during in-flight action
		button.disabled = true;
		const originalText = button.textContent;
		button.textContent = "Registrando...";

		const payload: QuickCheckinBookingPayload = {
			booking_id: attendee.booking_id,
			paid_cash: paidCash,
			notes: paidCash ? "Cobro en puerta" : undefined,
		};

		try {
			await quickCheckin(payload);

			// Mutate local state
			attendee.attended = true;
			attendee.booking_status = "COMPLETED";
			if (paidCash) {
				attendee.payment_status = "ACKNOWLEDGED";
			}
			session.attended_count += 1;

			// Update UI
			updateRowAttendanceState(rowEl, attendee);
			updateCapacityDisplay(session, sessionIdx);

			showToast("Asistencia registrada con éxito.", "success");
			onStateChange?.();
		} catch (err: unknown) {
			const apiError = err instanceof ApiError ? err : null;
			const detail =
				apiError?.detail || (err instanceof Error ? err.message : "");
			const conflictType = disambiguate409Error(detail);

			if (conflictType === "ALREADY_CHECKED_IN") {
				// 409 Case A: Authoritative server state reconciliation
				try {
					const freshSessions = await fetchRosters({
						date_from: selectedDate,
						date_to: selectedDate,
					});
					cachedSessions = reconcileSessionsWithServer(
						cachedSessions,
						freshSessions,
					);
					if (contentEl) {
						renderSessions(contentEl, cachedSessions);
					}
				} catch {
					// Fallback to local row reconciliation if refresh fetch fails
					const incremented = reconcileAlreadyCheckedInState(session, attendee);
					if (incremented) {
						updateCapacityDisplay(session, sessionIdx);
					}
					updateRowAttendanceState(rowEl, attendee);
				}

				showToast("El asistente ya contaba con asistencia registrada", "info");
				onStateChange?.();
			} else {
				// Ordinary failure / timeout
				button.disabled = false;
				button.textContent = originalText;
				showToast(
					apiError?.detail ||
						"Error al registrar asistencia. Intenta nuevamente.",
					"error",
				);
			}
		}
	}

	function updateRowAttendanceState(
		rowEl: HTMLElement | null,
		attendee: RosterAttendee,
	): void {
		if (!rowEl) return;
		rowEl.classList.add("row-attended");

		const attBadgeSlot = rowEl.querySelector(".badge-slot-attendance");
		if (attBadgeSlot) {
			attBadgeSlot.innerHTML = renderAttendanceStatusBadge(true, "COMPLETED");
		}

		if (attendee.payment_status === "ACKNOWLEDGED") {
			const pBadgeSlot = rowEl.querySelector(".badge-slot-payment");
			if (pBadgeSlot) {
				pBadgeSlot.innerHTML = renderPaymentStatusPill("ACKNOWLEDGED");
			}
		}

		const actionCol = rowEl.querySelector(".attendee-col-actions");
		if (actionCol) {
			actionCol.innerHTML = `
				<button type="button" class="btn btn-secondary btn-sm btn-checkin" disabled aria-disabled="true">
					✓ Asistió
				</button>
			`;
		}
	}

	function updateCapacityDisplay(
		session: RosterSession,
		sessionIdx: number,
	): void {
		const counterEl = container.querySelector(
			`#capacity-counter-${sessionIdx}`,
		);
		if (counterEl) {
			counterEl.textContent = formatRosterCapacity(
				session.occupied_count,
				session.max_capacity,
				session.attended_count,
			);
		}
	}

	function openWalkInModal(session: RosterSession, sessionIdx: number): void {
		const existingBackdrop = document.getElementById("walkin-modal-backdrop");
		if (existingBackdrop) existingBackdrop.remove();

		const timeStr = formatRosterSessionTime(session.scheduled_at);
		const backdrop = document.createElement("div");
		backdrop.id = "walkin-modal-backdrop";
		backdrop.className = "modal-backdrop";

		backdrop.innerHTML = `
			<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="walkin-modal-title">
				<div class="modal-header">
					<div>
						<span class="modal-kicker">Asistencia Inmediata</span>
						<h3 id="walkin-modal-title" class="modal-title">Registrar Asistente Sin Cita</h3>
					</div>
					<button type="button" class="modal-close-btn" id="walkin-modal-close" aria-label="Cerrar ventana">&times;</button>
				</div>

				<div class="modal-body">
					<div class="summary-box">
						<div class="summary-row">
							<span class="summary-label">Taller:</span>
							<span class="summary-value font-medium">${escapeHtml(session.service_name)}</span>
						</div>
						<div class="summary-row">
							<span class="summary-label">Horario:</span>
							<span class="summary-value font-mono font-bold">${escapeHtml(timeStr)} hrs</span>
						</div>
						<div class="summary-row">
							<span class="summary-label">Capacidad Actual:</span>
							<span class="summary-value">${session.occupied_count} / ${session.max_capacity}</span>
						</div>
					</div>

					<form id="walkin-modal-form" class="modal-form-content">
						<div class="form-group">
							<label for="walkin-name" class="form-label">
								Nombre Completo <span class="text-danger">*</span>
							</label>
							<input
								type="text"
								id="walkin-name"
								name="client_name"
								class="form-input"
								placeholder="Ej. Lucía Vega"
								required
								autocomplete="name"
							/>
						</div>

						<div class="form-group">
							<label for="walkin-phone" class="form-label">
								Teléfono WhatsApp (10 o 12 dígitos) <span class="text-danger">*</span>
							</label>
							<input
								type="tel"
								id="walkin-phone"
								name="client_phone"
								class="form-input"
								placeholder="Ej. 525598765432 o 5598765432"
								required
								autocomplete="tel"
							/>
						</div>

						<div class="form-group">
							<label for="walkin-email" class="form-label">
								Correo Electrónico (Opcional)
							</label>
							<input
								type="email"
								id="walkin-email"
								name="client_email"
								class="form-input"
								placeholder="cliente@ejemplo.com"
								autocomplete="email"
							/>
						</div>

						<!-- Section 5.5: Cash Toggle defaults to TRUE (checked) -->
						<div class="form-group mt-3">
							<label class="form-checkbox-label" for="walkin-cash">
								<input
									type="checkbox"
									id="walkin-cash"
									name="paid_cash"
									class="form-checkbox"
									checked
								/>
								<span class="font-medium text-sm">Cobro en efectivo recibido</span>
							</label>
							<p class="text-xs text-muted mt-1" style="margin-left: 28px;">
								Registra el cobro en efectivo en puerta y acredita el pago automáticamente.
							</p>
						</div>

						<div id="walkin-modal-error" class="modal-error-box hidden" role="alert"></div>

						<div class="modal-actions">
							<button type="button" id="walkin-modal-cancel" class="btn btn-secondary">
								Cancelar
							</button>
							<button type="submit" id="walkin-modal-submit" class="btn btn-primary">
								Registrar y Marcar Asistencia
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
			.querySelector("#walkin-modal-close")
			?.addEventListener("click", () => close());
		backdrop
			.querySelector("#walkin-modal-cancel")
			?.addEventListener("click", () => close());
		backdrop.addEventListener("click", (e) => {
			if (e.target === backdrop) close();
		});

		const form = backdrop.querySelector<HTMLFormElement>("#walkin-modal-form");
		const nameInput = backdrop.querySelector<HTMLInputElement>("#walkin-name");
		const phoneInput =
			backdrop.querySelector<HTMLInputElement>("#walkin-phone");
		const emailInput =
			backdrop.querySelector<HTMLInputElement>("#walkin-email");
		const cashCheckbox =
			backdrop.querySelector<HTMLInputElement>("#walkin-cash");
		const submitBtn = backdrop.querySelector<HTMLButtonElement>(
			"#walkin-modal-submit",
		);
		const errorBox = backdrop.querySelector<HTMLDivElement>(
			"#walkin-modal-error",
		);

		nameInput?.focus();

		form?.addEventListener("submit", async (e) => {
			e.preventDefault();
			if (!submitBtn || !errorBox) return;

			// Double-submission prevention: Immediately disable button while in-flight
			submitBtn.disabled = true;
			submitBtn.textContent = "Registrando...";
			errorBox.classList.add("hidden");
			errorBox.textContent = "";

			const clientName = nameInput?.value.trim() ?? "";
			const clientPhone = phoneInput?.value.trim() ?? "";
			const clientEmail = emailInput?.value.trim() || undefined;
			const paidCash = cashCheckbox?.checked ?? true;

			const payload: QuickCheckinWalkInPayload = {
				service_id: session.service_id,
				scheduled_at: session.scheduled_at,
				client_name: clientName,
				client_phone: clientPhone,
				client_email: clientEmail,
				paid_cash: paidCash,
				notes: paidCash ? "Cobro en puerta (Walk-in)" : undefined,
			};

			try {
				const response = await quickCheckin(payload);

				// Mutation on local model
				session.occupied_count += 1;
				session.attended_count += 1;
				session.attendees.push(response.attendee);

				// Re-render session capacity counter and attendees list
				updateCapacityDisplay(session, sessionIdx);
				const containerEl = container.querySelector(
					`#attendees-container-${sessionIdx}`,
				);
				if (containerEl) {
					containerEl.innerHTML = renderAttendeesList(session, sessionIdx);
					bindSessionCardEvents(container);
				}

				close();
				showToast("Asistencia registrada con éxito.", "success");
				onStateChange?.();
			} catch (err: unknown) {
				const apiError = err instanceof ApiError ? err : null;
				const detail =
					apiError?.detail || (err instanceof Error ? err.message : "");
				const conflictType = disambiguate409Error(detail);

				submitBtn.disabled = false;
				submitBtn.textContent = "Registrar y Marcar Asistencia";

				if (conflictType === "CAPACITY_EXCEEDED") {
					// 409 Case B: Capacity reached. Preserve form inputs, show error
					errorBox.textContent =
						apiError?.detail ||
						"El taller ha alcanzado su cupo máximo para esta sesión.";
					errorBox.classList.remove("hidden");
				} else {
					errorBox.textContent =
						apiError?.detail ||
						(err instanceof Error
							? err.message
							: "Error al registrar asistente sin cita");
					errorBox.classList.remove("hidden");
				}
			}
		});
	}

	// Navigation bindings
	btnToday?.addEventListener("click", () => {
		const today = getTodayDateString();
		if (selectedDate !== today) {
			selectedDate = today;
			updateDateFilterPills(selectedDate);
			loadSessions();
		}
	});

	btnTomorrow?.addEventListener("click", () => {
		const today = getTodayDateString();
		const d = new Date(`${today}T12:00:00`);
		d.setDate(d.getDate() + 1);
		const tomorrow = d.toISOString().slice(0, 10);
		if (selectedDate !== tomorrow) {
			selectedDate = tomorrow;
			updateDateFilterPills(selectedDate);
			loadSessions();
		}
	});

	dateInput?.addEventListener("change", () => {
		if (dateInput.value && dateInput.value !== selectedDate) {
			selectedDate = dateInput.value;
			updateDateFilterPills(selectedDate);
			loadSessions();
		}
	});

	btnRefresh?.addEventListener("click", () => {
		loadSessions();
	});

	// Initial load
	updateDateFilterPills(selectedDate);
	loadSessions();
}
