export interface BookingSummaryContext {
	bookingCode: string;
	clientName?: string | null;
	serviceName?: string | null;
	scheduledAtFormatted?: string | null;
}

export interface PromptModalOptions {
	title: string;
	kicker?: string;
	subtitle?: string;
	bookingContext?: BookingSummaryContext;
	label: string;
	defaultValue?: string;
	placeholder?: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: (value: string) => Promise<void> | void;
	onCancel?: () => void;
}

export interface ConfirmModalOptions {
	title: string;
	kicker?: string;
	message: string;
	bookingContext?: BookingSummaryContext;
	withReasonInput?: boolean;
	reasonLabel?: string;
	defaultReason?: string;
	reasonPlaceholder?: string;
	confirmText?: string;
	cancelText?: string;
	isDanger?: boolean;
	onConfirm: (reason: string) => Promise<void> | void;
	onCancel?: () => void;
}

export function showPromptModal(options: PromptModalOptions): void {
	const {
		title,
		kicker = "Acción Requerida",
		subtitle,
		bookingContext,
		label,
		defaultValue = "",
		placeholder = "",
		confirmText = "Confirmar",
		cancelText = "Cancelar",
		onConfirm,
		onCancel,
	} = options;

	const existingBackdrop = document.getElementById("micro-modal-backdrop");
	if (existingBackdrop) existingBackdrop.remove();

	const backdrop = document.createElement("div");
	backdrop.id = "micro-modal-backdrop";
	backdrop.className = "modal-backdrop";

	const summaryHtml = bookingContext
		? `
			<div class="summary-box">
				<div class="summary-row">
					<span class="summary-label">Folio:</span>
					<span class="summary-value font-mono font-bold">${bookingContext.bookingCode}</span>
				</div>
				${
					bookingContext.clientName
						? `
				<div class="summary-row">
					<span class="summary-label">Paciente:</span>
					<span class="summary-value">${bookingContext.clientName}</span>
				</div>`
						: ""
				}
				${
					bookingContext.serviceName
						? `
				<div class="summary-row">
					<span class="summary-label">Servicio:</span>
					<span class="summary-value">${bookingContext.serviceName}</span>
				</div>`
						: ""
				}
				${
					bookingContext.scheduledAtFormatted
						? `
				<div class="summary-row">
					<span class="summary-label">Horario:</span>
					<span class="summary-value font-medium">${bookingContext.scheduledAtFormatted}</span>
				</div>`
						: ""
				}
			</div>
		`
		: "";

	backdrop.innerHTML = `
		<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="micro-modal-title">
			<div class="modal-header">
				<div>
					<span class="modal-kicker">${kicker}</span>
					<h3 id="micro-modal-title" class="modal-title">${title}</h3>
				</div>
				<button type="button" class="modal-close-btn" id="micro-modal-close" aria-label="Cerrar modal">&times;</button>
			</div>

			<div class="modal-body">
				${subtitle ? `<p class="modal-subtitle-text">${subtitle}</p>` : ""}
				${summaryHtml}

				<form id="micro-modal-form" class="modal-form-content">
					<div class="form-group">
						<label for="prompt-input" class="form-label">${label}</label>
						<textarea
							id="prompt-input"
							name="prompt_value"
							class="form-textarea"
							rows="3"
							placeholder="${placeholder}"
							required
						>${defaultValue}</textarea>
					</div>

					<div id="micro-modal-error" class="modal-error-box hidden"></div>

					<div class="modal-actions">
						<button type="button" id="micro-modal-cancel" class="btn btn-secondary">
							${cancelText}
						</button>
						<button type="submit" id="micro-modal-submit" class="btn btn-primary">
							${confirmText}
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
		onCancel?.();
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") close();
	};
	document.addEventListener("keydown", handleKeyDown);

	backdrop
		.querySelector("#micro-modal-close")
		?.addEventListener("click", () => close());
	backdrop
		.querySelector("#micro-modal-cancel")
		?.addEventListener("click", () => close());
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) close();
	});

	const form = backdrop.querySelector<HTMLFormElement>("#micro-modal-form");
	const textarea = backdrop.querySelector<HTMLTextAreaElement>("#prompt-input");
	const submitBtn = backdrop.querySelector<HTMLButtonElement>(
		"#micro-modal-submit",
	);
	const errorBox = backdrop.querySelector<HTMLDivElement>("#micro-modal-error");

	textarea?.focus();

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const val = textarea?.value.trim() ?? "";
		if (!submitBtn || !errorBox) return;

		submitBtn.disabled = true;
		submitBtn.textContent = "Procesando...";
		errorBox.classList.add("hidden");
		errorBox.textContent = "";

		try {
			await onConfirm(val);
			backdrop.remove();
			document.removeEventListener("keydown", handleKeyDown);
		} catch (err: unknown) {
			submitBtn.disabled = false;
			submitBtn.textContent = confirmText;
			errorBox.textContent =
				err instanceof Error ? err.message : "Error al procesar la acción";
			errorBox.classList.remove("hidden");
		}
	});
}

export function showConfirmModal(options: ConfirmModalOptions): void {
	const {
		title,
		kicker = "Confirmación Requerida",
		message,
		bookingContext,
		withReasonInput = false,
		reasonLabel = "Motivo de la acción:",
		defaultReason = "",
		reasonPlaceholder = "Describe el motivo...",
		confirmText = "Confirmar",
		cancelText = "Cancelar",
		isDanger = false,
		onConfirm,
		onCancel,
	} = options;

	const existingBackdrop = document.getElementById("micro-modal-backdrop");
	if (existingBackdrop) existingBackdrop.remove();

	const backdrop = document.createElement("div");
	backdrop.id = "micro-modal-backdrop";
	backdrop.className = "modal-backdrop";

	const summaryHtml = bookingContext
		? `
			<div class="summary-box">
				<div class="summary-row">
					<span class="summary-label">Folio:</span>
					<span class="summary-value font-mono font-bold">${bookingContext.bookingCode}</span>
				</div>
				${
					bookingContext.clientName
						? `
				<div class="summary-row">
					<span class="summary-label">Paciente:</span>
					<span class="summary-value">${bookingContext.clientName}</span>
				</div>`
						: ""
				}
				${
					bookingContext.serviceName
						? `
				<div class="summary-row">
					<span class="summary-label">Servicio:</span>
					<span class="summary-value">${bookingContext.serviceName}</span>
				</div>`
						: ""
				}
				${
					bookingContext.scheduledAtFormatted
						? `
				<div class="summary-row">
					<span class="summary-label">Horario:</span>
					<span class="summary-value font-medium">${bookingContext.scheduledAtFormatted}</span>
				</div>`
						: ""
				}
			</div>
		`
		: "";

	const reasonSectionHtml = withReasonInput
		? `
			<div class="form-group" style="margin-top: 12px;">
				<label for="confirm-reason-input" class="form-label">${reasonLabel}</label>
				<textarea
					id="confirm-reason-input"
					name="reason"
					class="form-textarea"
					rows="2"
					placeholder="${reasonPlaceholder}"
					required
				>${defaultReason}</textarea>
			</div>
		`
		: "";

	backdrop.innerHTML = `
		<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
			<div class="modal-header">
				<div>
					<span class="modal-kicker ${isDanger ? "text-danger" : ""}">${kicker}</span>
					<h3 id="confirm-modal-title" class="modal-title">${title}</h3>
				</div>
				<button type="button" class="modal-close-btn" id="confirm-modal-close" aria-label="Cerrar modal">&times;</button>
			</div>

			<div class="modal-body">
				<div class="${isDanger ? "reassuring-warning-box" : "modal-message-box"}">
					${message}
				</div>

				${summaryHtml}
				${reasonSectionHtml}

				<div id="confirm-modal-error" class="modal-error-box hidden"></div>

				<div class="modal-actions">
					<button type="button" id="confirm-modal-cancel" class="btn btn-secondary">
						${cancelText}
					</button>
					<button type="button" id="confirm-modal-submit" class="btn ${isDanger ? "btn-danger" : "btn-primary"}">
						${confirmText}
					</button>
				</div>
			</div>
		</div>
	`;

	document.body.appendChild(backdrop);

	const close = () => {
		backdrop.remove();
		document.removeEventListener("keydown", handleKeyDown);
		onCancel?.();
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") close();
	};
	document.addEventListener("keydown", handleKeyDown);

	backdrop
		.querySelector("#confirm-modal-close")
		?.addEventListener("click", () => close());
	backdrop
		.querySelector("#confirm-modal-cancel")
		?.addEventListener("click", () => close());
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) close();
	});

	const submitBtn = backdrop.querySelector<HTMLButtonElement>(
		"#confirm-modal-submit",
	);
	const errorBox = backdrop.querySelector<HTMLDivElement>(
		"#confirm-modal-error",
	);
	const reasonInput = backdrop.querySelector<HTMLTextAreaElement>(
		"#confirm-reason-input",
	);

	submitBtn?.focus();

	submitBtn?.addEventListener("click", async () => {
		if (!submitBtn || !errorBox) return;
		const reasonVal = reasonInput ? reasonInput.value.trim() : "";

		submitBtn.disabled = true;
		submitBtn.textContent = "Procesando...";
		errorBox.classList.add("hidden");
		errorBox.textContent = "";

		try {
			await onConfirm(reasonVal);
			backdrop.remove();
			document.removeEventListener("keydown", handleKeyDown);
		} catch (err: unknown) {
			submitBtn.disabled = false;
			submitBtn.textContent = confirmText;
			errorBox.textContent =
				err instanceof Error ? err.message : "Error al procesar la acción";
			errorBox.classList.remove("hidden");
		}
	});
}
