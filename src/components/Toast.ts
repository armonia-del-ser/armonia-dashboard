export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastOptions {
	message: string;
	type?: ToastType;
	durationMs?: number;
	folio?: string;
}

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
	if (!toastContainer || !document.body.contains(toastContainer)) {
		toastContainer = document.getElementById("toast-container");
		if (!toastContainer) {
			toastContainer = document.createElement("div");
			toastContainer.id = "toast-container";
			toastContainer.className = "toast-container";
			toastContainer.setAttribute("role", "status");
			toastContainer.setAttribute("aria-live", "polite");
			document.body.appendChild(toastContainer);
		}
	}
	return toastContainer;
}

export function showToast(
	message: string,
	type: ToastType = "info",
	durationMs = 4000,
	options?: { folio?: string },
): HTMLElement {
	const container = getToastContainer();

	const toast = document.createElement("div");
	toast.className = `toast-item toast-${type}`;
	toast.setAttribute("role", type === "error" ? "alert" : "status");

	const icons: Record<ToastType, string> = {
		success: "✓",
		warning: "⏳",
		error: "⚠️",
		info: "ℹ️",
	};

	toast.innerHTML = `
		<div class="toast-icon" aria-hidden="true">${icons[type]}</div>
		<div class="toast-content">
			${options?.folio ? `<span class="toast-folio">${options.folio}</span>` : ""}
			<span class="toast-message">${message}</span>
		</div>
		<button type="button" class="toast-close-btn" aria-label="Cerrar notificación">
			<span aria-hidden="true">&times;</span>
		</button>
	`;

	const removeToast = () => {
		toast.classList.add("toast-leaving");
		setTimeout(() => {
			toast.remove();
		}, 250);
	};

	const closeBtn = toast.querySelector<HTMLButtonElement>(".toast-close-btn");
	closeBtn?.addEventListener("click", () => removeToast());

	container.appendChild(toast);

	// Trigger entry transition
	requestAnimationFrame(() => {
		toast.classList.add("toast-visible");
	});

	if (durationMs > 0) {
		setTimeout(() => {
			if (toast.isConnected) {
				removeToast();
			}
		}, durationMs);
	}

	return toast;
}
