import type { Booking } from "../types";
import { formatCurrency } from "../utils";

export interface PaymentModalOptions {
	booking: Booking;
	onConfirm: (payload: {
		booking_id: string;
		amount_mxn: number;
		payment_method: "SPEI" | "OXXO" | "CASH";
		notes?: string;
	}) => Promise<void>;
	onCancel: () => void;
}

export function openPaymentModal(options: {
	booking: Booking;
	onSuccess: (amount: number) => void;
}): void {
	const { booking, onSuccess } = options;

	const existingModal = document.getElementById("payment-modal-backdrop");
	if (existingModal) existingModal.remove();

	const backdrop = document.createElement("div");
	backdrop.id = "payment-modal-backdrop";
	backdrop.className = "modal-backdrop";

	backdrop.innerHTML = `
		<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
			<div class="modal-header">
				<div>
					<span class="modal-kicker">Recepción de Pago</span>
					<h3 id="modal-title" class="modal-title">Acreditar Pago de Reservación</h3>
				</div>
				<button type="button" class="modal-close-btn" id="modal-close" aria-label="Cerrar modal">&times;</button>
			</div>

			<div class="modal-body">
				<div class="summary-box">
					<div class="summary-row">
						<span class="summary-label">Folio:</span>
						<span class="summary-value font-mono font-bold">${booking.booking_code}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Paciente:</span>
						<span class="summary-value">${booking.client_name || "Cliente"}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Servicio:</span>
						<span class="summary-value">${booking.service_name || "Consulta"}</span>
					</div>
					<div class="summary-row">
						<span class="summary-label">Monto sugerido:</span>
						<span class="summary-value font-bold text-sage">${formatCurrency(booking.amount_mxn)}</span>
					</div>
				</div>

				<form id="payment-form" class="payment-form">
					<div class="form-group">
						<label for="payment-amount" class="form-label">Monto recibido (MXN):</label>
						<input
							type="number"
							id="payment-amount"
							name="amount"
							class="form-input"
							value="${booking.amount_mxn}"
							min="0"
							step="10"
							required
						/>
					</div>

					<div class="form-group">
						<label class="form-label">Método de pago:</label>
						<div class="payment-method-selector">
							<label class="method-option">
								<input type="radio" name="payment_method" value="SPEI" checked />
								<span>SPEI (Transferencia)</span>
							</label>
							<label class="method-option">
								<input type="radio" name="payment_method" value="CASH" />
								<span>Efectivo</span>
							</label>
							<label class="method-option">
								<input type="radio" name="payment_method" value="OXXO" />
								<span>OXXO</span>
							</label>
						</div>
					</div>

					<div class="form-group">
						<label for="payment-notes" class="form-label">Notas u observaciones (opcional):</label>
						<input
							type="text"
							id="payment-notes"
							name="notes"
							class="form-input"
							placeholder="Ej. Transferencia confirmada por Jasmin / BBVA Folio 987"
						/>
					</div>

					<div id="modal-error-box" class="modal-error-box hidden"></div>

					<div class="modal-actions">
						<button type="button" id="modal-cancel-btn" class="btn btn-secondary">
							Cancelar
						</button>
						<button type="submit" id="modal-submit-btn" class="btn btn-primary">
							Confirmar Acreditación
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
		.querySelector("#modal-close")
		?.addEventListener("click", () => close());
	backdrop
		.querySelector("#modal-cancel-btn")
		?.addEventListener("click", () => close());
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) close();
	});

	const form = backdrop.querySelector<HTMLFormElement>("#payment-form");
	const submitBtn =
		backdrop.querySelector<HTMLButtonElement>("#modal-submit-btn");
	const errorBox = backdrop.querySelector<HTMLDivElement>("#modal-error-box");

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!submitBtn || !errorBox) return;

		submitBtn.disabled = true;
		submitBtn.textContent = "Acreditando...";
		errorBox.classList.add("hidden");
		errorBox.textContent = "";

		const amountInput = form.querySelector<HTMLInputElement>("#payment-amount");
		const notesInput = form.querySelector<HTMLInputElement>("#payment-notes");
		const methodInput = form.querySelector<HTMLInputElement>(
			'input[name="payment_method"]:checked',
		);

		const amount = Number(amountInput?.value || booking.amount_mxn);
		const method = (methodInput?.value as "SPEI" | "OXXO" | "CASH") || "SPEI";
		const notes = notesInput?.value.trim() || undefined;

		try {
			const { acknowledgePayment } = await import("../api");
			await acknowledgePayment({
				booking_id: booking.id,
				amount_mxn: amount,
				payment_method: method,
				notes,
			});
			close();
			onSuccess(amount);
		} catch (err: unknown) {
			submitBtn.disabled = false;
			submitBtn.textContent = "Confirmar Acreditación";
			errorBox.textContent =
				err instanceof Error ? err.message : "Error al procesar el pago";
			errorBox.classList.remove("hidden");
		}
	});
}
