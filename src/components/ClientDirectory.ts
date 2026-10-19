import { fetchPackages, searchClients, updateClient } from "../api";
import type { Client, PackageRecord } from "../types";
import { debounce, formatMexicanPhone, getCleanDigitsPhone } from "../utils";
import { showToast } from "./Toast";

export function renderClientDirectory(
	container: HTMLElement,
	onStateChange?: () => void,
): void {
	container.innerHTML = `
		<div class="view-header">
			<div>
				<h2 class="view-title">Directorio de Consultantes</h2>
				<p class="view-subtitle">Expedientes de contacto, notas clínicas y seguimiento de paquetes activos.</p>
			</div>
			<div class="view-actions">
				<button id="refresh-clients-btn" class="btn btn-secondary btn-sm" title="Refrescar directorio">
					↻ Actualizar
				</button>
			</div>
		</div>

		<!-- Search Bar -->
		<div class="directory-search-bar">
			<div class="search-input-group">
				<span class="search-icon" aria-hidden="true">🔍</span>
				<input
					type="search"
					id="client-directory-search"
					class="form-input directory-search-input"
					placeholder="Buscar consultante por nombre o teléfono WhatsApp..."
					aria-label="Buscar consultante por nombre o teléfono"
				/>
				<button type="button" id="clear-search-btn" class="btn-clear-input hidden" title="Limpiar búsqueda">&times;</button>
			</div>
			<div id="clients-counter" class="clients-counter-pill text-xs text-muted"></div>
		</div>

		<!-- Main Container (5 States) -->
		<div id="clients-content" class="clients-list-container">
			<div class="loading-state">
				<div class="skeleton-card"></div>
				<div class="skeleton-card"></div>
			</div>
		</div>
	`;

	const contentDiv =
		container.querySelector<HTMLDivElement>("#clients-content");
	const searchInput = container.querySelector<HTMLInputElement>(
		"#client-directory-search",
	);
	const clearSearchBtn =
		container.querySelector<HTMLButtonElement>("#clear-search-btn");
	const counterDiv =
		container.querySelector<HTMLDivElement>("#clients-counter");
	const refreshBtn = container.querySelector<HTMLButtonElement>(
		"#refresh-clients-btn",
	);

	let cachedClients: Client[] = [];
	let cachedPackages: PackageRecord[] = [];
	let currentQuery = "";

	const loadData = async (query = "") => {
		if (!contentDiv) return;
		currentQuery = query;

		contentDiv.innerHTML = `
			<div class="loading-state">
				<div class="skeleton-card"></div>
				<div class="skeleton-card"></div>
			</div>
		`;

		try {
			// Fetch clients and packages concurrently for resilient state
			const [clientsResult, packagesResult] = await Promise.allSettled([
				searchClients(query),
				fetchPackages(),
			]);

			if (clientsResult.status === "rejected") {
				throw new Error(
					clientsResult.reason instanceof Error
						? clientsResult.reason.message
						: "Error al cargar la lista de consultantes.",
				);
			}

			cachedClients = clientsResult.value;
			cachedPackages =
				packagesResult.status === "fulfilled" ? packagesResult.value : [];

			renderClients(cachedClients, cachedPackages);
		} catch (err: unknown) {
			renderError(err instanceof Error ? err.message : "Error desconocido");
		}
	};

	const renderError = (msg: string) => {
		if (!contentDiv) return;
		contentDiv.innerHTML = `
			<div class="card error-state">
				<div class="error-icon">⚠️</div>
				<h3 class="error-title">No se pudo cargar el directorio</h3>
				<p class="error-desc">${msg}</p>
				<button id="retry-clients-btn" class="btn btn-primary btn-sm">
					Intentar de nuevo
				</button>
			</div>
		`;
		contentDiv
			.querySelector("#retry-clients-btn")
			?.addEventListener("click", () => loadData(currentQuery));
	};

	const renderClients = (clients: Client[], packages: PackageRecord[]) => {
		if (!contentDiv) return;

		if (counterDiv) {
			counterDiv.textContent = `${clients.length} ${clients.length === 1 ? "consultante registrado" : "consultantes registrados"}`;
		}

		if (clients.length === 0) {
			contentDiv.innerHTML = `
				<div class="card empty-state">
					<div class="empty-icon">👥</div>
					<h3 class="empty-title">
						${currentQuery ? "Sin coincidencias" : "Directorio vacío"}
					</h3>
					<p class="empty-desc">
						${
							currentQuery
								? `No se encontraron consultantes para "<strong>${escapeHtml(currentQuery)}</strong>". Puedes registrar una nueva cita desde el botón superior.`
								: "Aún no hay consultantes registrados en el sistema."
						}
					</p>
				</div>
			`;
			return;
		}

		contentDiv.innerHTML = `
			<div class="clients-grid">
				${clients
					.map((c) => {
						const clientPackages = packages.filter(
							(p) =>
								p.client_id === c.id && p.completed_sessions < p.total_sessions,
						);

						const cleanDigits = getCleanDigitsPhone(c.phone_whatsapp);
						const waLink = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(
							`Hola ${c.full_name}, te saludamos de Armonía del Ser.`,
						)}`;

						const packagesHtml =
							clientPackages.length > 0
								? clientPackages
										.map(
											(pkg) => `
									<span class="package-pill" title="Sesiones completadas del paquete">
										📦 Paquete: ${pkg.completed_sessions} de ${pkg.total_sessions}
										${pkg.service_name ? `(${escapeHtml(pkg.service_name)})` : ""}
									</span>
								`,
										)
										.join("")
								: '<span class="text-xs text-muted">Sin paquetes activos</span>';

						return `
							<div class="client-card" id="client-card-${c.id}">
								<div class="client-card-header">
									<div>
										<h3 class="client-card-name">${escapeHtml(c.full_name)}</h3>
										<span class="client-registered-date text-xs text-muted">
											Registrado el ${new Date(c.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
										</span>
									</div>
									<button
										type="button"
										class="btn btn-secondary btn-sm btn-edit-client"
										data-client-id="${c.id}"
										title="Editar datos de contacto o notas clínicas"
									>
										✏️ Editar
									</button>
								</div>

								<div class="client-card-body">
									<div class="client-contact-row">
										<a
											href="${waLink}"
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-whatsapp btn-xs"
											title="Abrir WhatsApp para mensaje directo"
										>
											<span>💬 ${escapeHtml(c.phone_whatsapp)}</span>
										</a>
										${
											c.email
												? `<span class="client-email-badge text-xs">✉️ ${escapeHtml(c.email)}</span>`
												: '<span class="text-xs text-muted">Sin correo</span>'
										}
									</div>

									<div class="client-packages-row mt-2">
										<span class="detail-label text-xs font-semibold">Estado de Paquetes:</span>
										<div class="packages-tags-container mt-1">
											${packagesHtml}
										</div>
									</div>

									${
										c.notes
											? `
										<div class="client-notes-box mt-3">
											<span class="notes-kicker text-xs font-semibold">Notas Clínicas / Operativas:</span>
											<p class="notes-content text-sm mt-1">${escapeHtml(c.notes)}</p>
										</div>
									`
											: `
										<div class="client-notes-empty mt-2 text-xs text-muted">
											Sin notas adicionales registradas.
										</div>
									`
									}
								</div>
							</div>
						`;
					})
					.join("")}
			</div>
		`;

		// Attach Edit Handlers
		contentDiv.querySelectorAll(".btn-edit-client").forEach((btn) => {
			btn.addEventListener("click", () => {
				const id = btn.getAttribute("data-client-id");
				const client = clients.find((c) => c.id === id);
				if (!client) return;

				openEditClientModal({
					client,
					onSuccess: (updated) => {
						showToast(
							`Datos actualizados para ${updated.full_name}`,
							"success",
							4500,
						);
						loadData(currentQuery);
						onStateChange?.();
					},
				});
			});
		});
	};

	// Debounced Search Handler
	const onSearchInput = debounce((val: string) => {
		if (clearSearchBtn) {
			clearSearchBtn.classList.toggle("hidden", val.length === 0);
		}
		loadData(val);
	}, 250);

	searchInput?.addEventListener("input", () => {
		onSearchInput(searchInput.value);
	});

	clearSearchBtn?.addEventListener("click", () => {
		if (searchInput) {
			searchInput.value = "";
			clearSearchBtn.classList.add("hidden");
			loadData("");
			searchInput.focus();
		}
	});

	refreshBtn?.addEventListener("click", () => loadData(currentQuery));

	// Initial load
	loadData("");
}

export interface EditClientModalOptions {
	client: Client;
	onSuccess: (updated: Client) => void;
}

export function openEditClientModal(options: EditClientModalOptions): void {
	const { client, onSuccess } = options;

	const existingBackdrop = document.getElementById(
		"edit-client-modal-backdrop",
	);
	if (existingBackdrop) existingBackdrop.remove();

	const backdrop = document.createElement("div");
	backdrop.id = "edit-client-modal-backdrop";
	backdrop.className = "modal-backdrop";

	backdrop.innerHTML = `
		<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-client-title">
			<div class="modal-header">
				<div>
					<span class="modal-kicker">Expediente de Consultante</span>
					<h3 id="edit-client-title" class="modal-title">Editar Consultante</h3>
				</div>
				<button type="button" class="modal-close-btn" id="edit-modal-close" aria-label="Cerrar modal">&times;</button>
			</div>

			<div class="modal-body">
				<form id="edit-client-form" class="modal-form-content">
					<div class="form-group">
						<label for="edit-client-name" class="form-label font-semibold">
							Nombre Completo <span class="text-danger">*</span>
						</label>
						<input
							type="text"
							id="edit-client-name"
							name="full_name"
							class="form-input"
							value="${escapeHtml(client.full_name)}"
							required
							minlength="2"
						/>
					</div>

					<div class="form-group">
						<label for="edit-client-phone" class="form-label font-semibold">
							Teléfono WhatsApp (+52) <span class="text-danger">*</span>
						</label>
						<input
							type="tel"
							id="edit-client-phone"
							name="phone_whatsapp"
							class="form-input"
							value="${escapeHtml(formatMexicanPhone(client.phone_whatsapp))}"
							required
							minlength="10"
						/>
					</div>

					<div class="form-group">
						<label for="edit-client-email" class="form-label font-semibold">
							Correo Electrónico (opcional)
						</label>
						<input
							type="email"
							id="edit-client-email"
							name="email"
							class="form-input"
							value="${escapeHtml(client.email || "")}"
							placeholder="correo@ejemplo.com"
						/>
					</div>

					<div class="form-group">
						<label for="edit-client-notes" class="form-label font-semibold">
							Notas Clínicas u Operativas
						</label>
						<textarea
							id="edit-client-notes"
							name="notes"
							class="form-textarea"
							rows="3"
							placeholder="Observaciones de salud, antecedentes, preferencias de horario..."
						>${escapeHtml(client.notes || "")}</textarea>
					</div>

					<div id="edit-client-error" class="modal-error-box hidden" role="alert"></div>

					<div class="modal-actions">
						<button type="button" id="edit-modal-cancel" class="btn btn-secondary">
							Cancelar
						</button>
						<button type="submit" id="edit-modal-submit" class="btn btn-primary">
							Guardar Cambios
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
		.querySelector("#edit-modal-close")
		?.addEventListener("click", () => close());
	backdrop
		.querySelector("#edit-modal-cancel")
		?.addEventListener("click", () => close());
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) close();
	});

	const form = backdrop.querySelector<HTMLFormElement>("#edit-client-form");
	const nameInput =
		backdrop.querySelector<HTMLInputElement>("#edit-client-name");
	const phoneInput =
		backdrop.querySelector<HTMLInputElement>("#edit-client-phone");
	const emailInput =
		backdrop.querySelector<HTMLInputElement>("#edit-client-email");
	const notesInput =
		backdrop.querySelector<HTMLTextAreaElement>("#edit-client-notes");
	const submitBtn =
		backdrop.querySelector<HTMLButtonElement>("#edit-modal-submit");
	const errorBox = backdrop.querySelector<HTMLDivElement>("#edit-client-error");

	phoneInput?.addEventListener("blur", () => {
		if (phoneInput.value) {
			phoneInput.value = formatMexicanPhone(phoneInput.value);
		}
	});

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!submitBtn || !errorBox) return;

		const full_name = nameInput?.value.trim();
		const raw_phone = phoneInput?.value.trim() || "";
		const phone_whatsapp = formatMexicanPhone(raw_phone);
		const raw_email = emailInput?.value.trim();
		const email = raw_email || null;
		const raw_notes = notesInput?.value.trim();
		const notes = raw_notes || null;

		if (!full_name || !phone_whatsapp) {
			errorBox.textContent = "El nombre y teléfono son obligatorios.";
			errorBox.classList.remove("hidden");
			return;
		}

		submitBtn.disabled = true;
		submitBtn.textContent = "Guardando...";
		errorBox.classList.add("hidden");
		errorBox.textContent = "";

		try {
			const updated = await updateClient(client.id, {
				full_name,
				phone_whatsapp,
				email,
				notes,
			});
			close();
			onSuccess(updated);
		} catch (err: unknown) {
			submitBtn.disabled = false;
			submitBtn.textContent = "Guardar Cambios";
			errorBox.textContent =
				err instanceof Error
					? err.message
					: "Error al actualizar datos del cliente.";
			errorBox.classList.remove("hidden");
		}
	});

	nameInput?.focus();
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
