import { createBooking, fetchServices, searchClients } from "../api";
import type { Booking, Client, Service } from "../types";
import {
	debounce,
	formatCurrency,
	formatDateInput,
	formatMexicanPhone,
} from "../utils";
import { showToast } from "./Toast";

export interface IntakeModalOptions {
	onSuccess: (booking: Booking) => void;
	defaultDate?: Date;
}

export function openBookingIntakeModal(options: IntakeModalOptions): void {
	const { onSuccess, defaultDate = new Date() } = options;

	const existingBackdrop = document.getElementById("intake-modal-backdrop");
	if (existingBackdrop) existingBackdrop.remove();

	const backdrop = document.createElement("div");
	backdrop.id = "intake-modal-backdrop";
	backdrop.className = "modal-backdrop intake-modal-backdrop";

	const defaultDateStr = formatDateInput(defaultDate);
	// Default time: next hour or 10:00
	const currentHour = new Date().getHours();
	const nextHour = Math.min(20, Math.max(9, currentHour + 1));
	const defaultTimeStr = `${String(nextHour).padStart(2, "0")}:00`;

	backdrop.innerHTML = `
		<div class="modal-card modal-card-lg" role="dialog" aria-modal="true" aria-labelledby="intake-modal-title">
			<div class="modal-header">
				<div>
					<span class="modal-kicker">Recepción Operativa</span>
					<h3 id="intake-modal-title" class="modal-title">＋ Nueva Cita</h3>
				</div>
				<button type="button" class="modal-close-btn" id="intake-modal-close" aria-label="Cerrar ventana">&times;</button>
			</div>

			<div class="modal-body">
				<p class="modal-subtitle-text">
					Registra una cita directa. Se aplicará la validación de colisiones y buffer de 15 minutos obligatorio.
				</p>

				<form id="intake-form" class="modal-form-content">
					<!-- 1. Servicio -->
					<div class="form-group">
						<label for="intake-service" class="form-label font-semibold">
							1. Servicio <span class="text-danger">*</span>
						</label>
						<select id="intake-service" name="service_id" class="form-select" required>
							<option value="">Cargando servicios...</option>
						</select>
						<div id="service-preview-hint" class="service-preview-hint text-xs text-muted mt-1"></div>
					</div>

					<!-- 2. Cliente Search Combobox -->
					<div class="form-group client-combobox-group">
						<div class="combobox-label-row">
							<label for="client-search-input" class="form-label font-semibold">
								2. Paciente / Consultante <span class="text-danger">*</span>
							</label>
							<span id="client-type-badge" class="client-type-badge badge-new">✦ Nuevo Consultante</span>
						</div>

						<div class="combobox-wrapper">
							<div class="combobox-input-container">
								<span class="combobox-icon" aria-hidden="true">🔍</span>
								<input
									type="text"
									id="client-search-input"
									class="form-input combobox-input"
									placeholder="Buscar por nombre o teléfono, o escribir uno nuevo..."
									autocomplete="off"
									required
								/>
								<button type="button" id="clear-client-btn" class="btn-clear-input hidden" title="Limpiar selección">&times;</button>
							</div>

							<!-- Autocomplete dropdown list -->
							<div id="combobox-dropdown" class="combobox-dropdown hidden" role="listbox"></div>
						</div>

						<div class="client-fields-grid mt-2">
							<div class="form-subgroup">
								<label for="client-phone-input" class="form-sublabel">Teléfono WhatsApp (+52) <span class="text-danger">*</span></label>
								<input
									type="tel"
									id="client-phone-input"
									name="client_phone"
									class="form-input"
									placeholder="+52 55 1234 5678"
									required
								/>
							</div>
							<div class="form-subgroup">
								<label for="client-email-input" class="form-sublabel">Correo Electrónico (opcional)</label>
								<input
									type="email"
									id="client-email-input"
									name="client_email"
									class="form-input"
									placeholder="correo@ejemplo.com"
								/>
							</div>
						</div>
					</div>

					<!-- 3. Fecha y Hora -->
					<div class="form-group">
						<label class="form-label font-semibold">
							3. Fecha y Horario <span class="text-danger">*</span>
						</label>
						<div class="datetime-grid">
							<div class="form-subgroup">
								<label for="intake-date" class="form-sublabel">Día de la cita:</label>
								<input
									type="date"
									id="intake-date"
									class="form-input"
									value="${defaultDateStr}"
									required
								/>
							</div>
							<div class="form-subgroup">
								<label for="intake-time" class="form-sublabel">Hora de inicio:</label>
								<input
									type="time"
									id="intake-time"
									class="form-input"
									value="${defaultTimeStr}"
									step="900"
									required
								/>
							</div>
						</div>
					</div>

					<!-- 4. Notas u Observaciones -->
					<div class="form-group">
						<label for="intake-notes" class="form-label font-semibold">
							4. Motivo de Consulta u Observaciones (opcional)
						</label>
						<textarea
							id="intake-notes"
							name="notes"
							class="form-textarea"
							rows="2"
							placeholder="Ej. Primera vez con dolor lumbar; recomendada por María."
						></textarea>
					</div>

					<!-- Error container -->
					<div id="intake-error" class="modal-error-box hidden" role="alert"></div>

					<!-- Modal actions -->
					<div class="modal-actions">
						<button type="button" id="intake-cancel-btn" class="btn btn-secondary">
							Cancelar
						</button>
						<button type="submit" id="intake-submit-btn" class="btn btn-primary btn-submit-intake">
							<span>✓ Agendar Cita</span>
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
		.querySelector("#intake-modal-close")
		?.addEventListener("click", () => close());
	backdrop
		.querySelector("#intake-cancel-btn")
		?.addEventListener("click", () => close());
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) close();
	});

	// Elements
	const form = backdrop.querySelector<HTMLFormElement>("#intake-form");
	const serviceSelect =
		backdrop.querySelector<HTMLSelectElement>("#intake-service");
	const serviceHint = backdrop.querySelector<HTMLDivElement>(
		"#service-preview-hint",
	);
	const searchInput = backdrop.querySelector<HTMLInputElement>(
		"#client-search-input",
	);
	const phoneInput = backdrop.querySelector<HTMLInputElement>(
		"#client-phone-input",
	);
	const emailInput = backdrop.querySelector<HTMLInputElement>(
		"#client-email-input",
	);
	const clientBadge =
		backdrop.querySelector<HTMLSpanElement>("#client-type-badge");
	const clearClientBtn =
		backdrop.querySelector<HTMLButtonElement>("#clear-client-btn");
	const dropdown = backdrop.querySelector<HTMLDivElement>("#combobox-dropdown");
	const dateInput = backdrop.querySelector<HTMLInputElement>("#intake-date");
	const timeInput = backdrop.querySelector<HTMLInputElement>("#intake-time");
	const notesInput =
		backdrop.querySelector<HTMLTextAreaElement>("#intake-notes");
	const errorBox = backdrop.querySelector<HTMLDivElement>("#intake-error");
	const submitBtn =
		backdrop.querySelector<HTMLButtonElement>("#intake-submit-btn");

	let availableServices: Service[] = [];
	let selectedClient: Client | null = null;

	// 1. Load Services
	fetchServices(true)
		.then((services) => {
			availableServices = services;
			if (!serviceSelect) return;
			if (services.length === 0) {
				serviceSelect.innerHTML =
					'<option value="">No hay servicios activos</option>';
				return;
			}

			serviceSelect.innerHTML = `
				<option value="">-- Selecciona un servicio --</option>
				${services
					.map(
						(s) => `
					<option value="${s.id}" data-duration="${s.duration_minutes}" data-buffer="${s.buffer_minutes}" data-price="${s.price_mxn}">
						${s.name} (${s.modality === "PRESENCIAL" ? "Presencial" : "En Línea"}) — ${s.duration_minutes} min — ${formatCurrency(s.price_mxn)}
					</option>
				`,
					)
					.join("")}
			`;

			// Auto-select first service if available
			if (services.length > 0) {
				serviceSelect.value = services[0].id;
				updateServiceHint(services[0]);
			}
		})
		.catch((err) => {
			if (serviceSelect) {
				serviceSelect.innerHTML =
					'<option value="">Error al cargar catálogo</option>';
			}
			if (errorBox) {
				errorBox.textContent = `Error al cargar servicios: ${err instanceof Error ? err.message : "Desconocido"}`;
				errorBox.classList.remove("hidden");
			}
		});

	const updateServiceHint = (svc?: Service) => {
		if (!serviceHint) return;
		if (!svc) {
			serviceHint.innerHTML = "";
			return;
		}
		serviceHint.innerHTML = `
			⏱️ Duración: <strong>${svc.duration_minutes} min</strong> + <strong>${svc.buffer_minutes || 15} min</strong> de colchón obligatorio protegido.
			${svc.price_mxn ? `&bull; Tarifa: <strong>${formatCurrency(svc.price_mxn)}</strong>` : ""}
		`;
	};

	serviceSelect?.addEventListener("change", () => {
		const sId = serviceSelect.value;
		const svc = availableServices.find((s) => s.id === sId);
		updateServiceHint(svc);
	});

	// 2. Client Combobox & Autocomplete
	const selectExistingClient = (c: Client) => {
		selectedClient = c;
		if (searchInput) searchInput.value = c.full_name;
		if (phoneInput) phoneInput.value = formatMexicanPhone(c.phone_whatsapp);
		if (emailInput) emailInput.value = c.email || "";
		if (clientBadge) {
			clientBadge.textContent = "✓ Cliente Registrado";
			clientBadge.className = "client-type-badge badge-existing";
		}
		clearClientBtn?.classList.remove("hidden");
		hideDropdown();
	};

	const clearSelectedClient = () => {
		selectedClient = null;
		if (searchInput) searchInput.value = "";
		if (phoneInput) phoneInput.value = "";
		if (emailInput) emailInput.value = "";
		if (clientBadge) {
			clientBadge.textContent = "✦ Nuevo Consultante";
			clientBadge.className = "client-type-badge badge-new";
		}
		clearClientBtn?.classList.add("hidden");
		hideDropdown();
		searchInput?.focus();
	};

	clearClientBtn?.addEventListener("click", clearSelectedClient);

	const hideDropdown = () => {
		if (dropdown) dropdown.classList.add("hidden");
	};

	const showDropdown = () => {
		if (dropdown) dropdown.classList.remove("hidden");
	};

	const doSearch = debounce(async (query: string) => {
		const q = query.trim();
		if (!q || !dropdown) {
			hideDropdown();
			return;
		}

		try {
			const results = await searchClients(q);
			if (results.length === 0) {
				dropdown.innerHTML = `
					<div class="combobox-empty">
						No se encontraron pacientes para "<strong>${escapeHtml(q)}</strong>".
						<span class="text-xs text-muted block mt-1">Se registrará como nuevo paciente con los datos ingresados.</span>
					</div>
				`;
				showDropdown();
				return;
			}

			dropdown.innerHTML = results
				.map(
					(c) => `
				<div class="combobox-item" role="option" data-id="${c.id}">
					<div class="font-medium">${escapeHtml(c.full_name)}</div>
					<div class="combobox-meta text-xs text-muted">
						<span>📱 ${escapeHtml(c.phone_whatsapp)}</span>
						${c.email ? `<span>✉️ ${escapeHtml(c.email)}</span>` : ""}
					</div>
				</div>
			`,
				)
				.join("");

			dropdown.querySelectorAll(".combobox-item").forEach((item) => {
				item.addEventListener("click", () => {
					const id = item.getAttribute("data-id");
					const found = results.find((r) => r.id === id);
					if (found) {
						selectExistingClient(found);
					}
				});
			});

			showDropdown();
		} catch {
			// Ignore autocomplete failure
		}
	}, 250);

	searchInput?.addEventListener("input", () => {
		const val = searchInput.value;
		if (selectedClient && val !== selectedClient.full_name) {
			selectedClient = null;
			if (clientBadge) {
				clientBadge.textContent = "✦ Nuevo Consultante";
				clientBadge.className = "client-type-badge badge-new";
			}
			clearClientBtn?.classList.remove("hidden");
		}
		doSearch(val);
	});

	// Auto format Mexican phone on blur
	phoneInput?.addEventListener("blur", () => {
		if (phoneInput.value) {
			phoneInput.value = formatMexicanPhone(phoneInput.value);
		}
	});

	// Close dropdown when clicking outside
	document.addEventListener("click", (e) => {
		if (
			dropdown &&
			!dropdown.contains(e.target as Node) &&
			e.target !== searchInput
		) {
			hideDropdown();
		}
	});

	// 3. Form Submit
	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!submitBtn || !errorBox) return;

		errorBox.classList.add("hidden");
		errorBox.textContent = "";

		const serviceId = serviceSelect?.value;
		const clientName = searchInput?.value.trim();
		let clientPhone = phoneInput?.value.trim();
		const clientEmail = emailInput?.value.trim() || undefined;
		const dateVal = dateInput?.value;
		const timeVal = timeInput?.value;
		const notesVal = notesInput?.value.trim() || undefined;

		if (!serviceId) {
			errorBox.textContent = "Por favor selecciona un servicio.";
			errorBox.classList.remove("hidden");
			return;
		}

		if (!clientName || !clientPhone) {
			errorBox.textContent =
				"El nombre y teléfono de WhatsApp del consultante son obligatorios.";
			errorBox.classList.remove("hidden");
			return;
		}

		// Ensure formatted phone
		clientPhone = formatMexicanPhone(clientPhone);

		if (!dateVal || !timeVal) {
			errorBox.textContent = "Por favor define la fecha y hora de la cita.";
			errorBox.classList.remove("hidden");
			return;
		}

		// Build scheduled_at in ISO format
		const localDateTimeString = `${dateVal}T${timeVal}:00`;
		const scheduledDate = new Date(localDateTimeString);
		if (Number.isNaN(scheduledDate.getTime())) {
			errorBox.textContent = "La fecha u hora seleccionada no es válida.";
			errorBox.classList.remove("hidden");
			return;
		}

		submitBtn.disabled = true;
		submitBtn.textContent = "Agendando sesión...";

		try {
			const booking = await createBooking({
				service_id: serviceId,
				client_name: clientName,
				client_phone: clientPhone,
				client_email: clientEmail,
				scheduled_at: scheduledDate.toISOString(),
				notes: notesVal,
			});

			close();
			onSuccess(booking);

			// Toast with Folio
			showToast(
				`Cita agendada para ${booking.client_name || clientName}`,
				"success",
				6000,
				{ folio: booking.booking_code },
			);

			// 1-Tap WhatsApp confirmation dialog
			showBookingCreatedSuccessModal(booking);
		} catch (err: unknown) {
			submitBtn.disabled = false;
			submitBtn.textContent = "✓ Agendar Cita";
			errorBox.textContent =
				err instanceof Error
					? err.message
					: "Error inesperado al registrar la cita.";
			errorBox.classList.remove("hidden");
		}
	});

	// Focus first input
	searchInput?.focus();
}

function showBookingCreatedSuccessModal(booking: Booking): void {
	const waUrl =
		booking.whatsapp_redirect_url ||
		`https://wa.me/${(booking.client_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
			`Hola ${booking.client_name || ""}, te confirmamos tu cita en Armonía del Ser con folio ${booking.booking_code}. ¡Te esperamos!`,
		)}`;

	const modal = document.createElement("div");
	modal.className = "modal-backdrop";
	modal.innerHTML = `
		<div class="modal-card" role="dialog" aria-modal="true">
			<div class="modal-header">
				<div>
					<span class="modal-kicker text-success">✓ Cita Confirmada</span>
					<h3 class="modal-title">Folio ${booking.booking_code}</h3>
				</div>
				<button type="button" class="modal-close-btn" id="success-modal-close">&times;</button>
			</div>
			<div class="modal-body">
				<div class="summary-box">
					<div class="summary-row">
						<span class="summary-label">Paciente:</span>
						<span class="summary-value font-semibold">${booking.client_name}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Servicio:</span>
						<span class="summary-value">${booking.service_name || "Consulta"}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Fecha y Hora:</span>
						<span class="summary-value font-medium">${new Date(booking.scheduled_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</span>
					</div>
				</div>

				<p class="modal-subtitle-text mt-3">
					La cita ha sido reservada y el buffer protector ha sido bloqueado en el sistema.
				</p>

				<div class="modal-actions mt-4">
					<a
						href="${waUrl}"
						target="_blank"
						rel="noopener noreferrer"
						id="btn-send-wa-confirm"
						class="btn btn-whatsapp"
					>
						<span>💬 Enviar Confirmación por WhatsApp</span>
					</a>
					<button type="button" id="success-modal-dismiss" class="btn btn-secondary">
						Listo
					</button>
				</div>
			</div>
		</div>
	`;

	document.body.appendChild(modal);

	const closeSuccess = () => modal.remove();
	modal
		.querySelector("#success-modal-close")
		?.addEventListener("click", closeSuccess);
	modal
		.querySelector("#success-modal-dismiss")
		?.addEventListener("click", closeSuccess);
	modal.querySelector("#btn-send-wa-confirm")?.addEventListener("click", () => {
		setTimeout(closeSuccess, 500);
	});
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
