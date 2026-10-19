import { fetchAllBookings } from "../api";
import type { Booking } from "../types";
import { formatCurrency, formatDateTime } from "../utils";
import {
	renderBookingStatusBadge,
	renderCalendarSyncBadge,
	renderPaymentStatusBadge,
} from "./StatusBadge";

export function renderAllBookings(container: HTMLElement): void {
	container.innerHTML = `
		<div class="view-header">
			<div>
				<h2 class="view-title">Historial General de Reservaciones</h2>
				<p class="view-subtitle">Registro completo de citas, cancelaciones y liberaciones de espacio.</p>
			</div>
			<div class="view-actions">
				<button id="refresh-all-btn" class="btn btn-secondary btn-sm" title="Refrescar lista">
					↻ Actualizar
				</button>
			</div>
		</div>

		<div class="filter-bar">
			<label for="status-filter" class="filter-label">Filtrar por estado:</label>
			<select id="status-filter" class="form-select">
				<option value="ALL">Todas las citas</option>
				<option value="RESERVED">Reservadas (Activas)</option>
				<option value="COMPLETED">Completadas</option>
				<option value="RELEASED">Liberadas</option>
				<option value="CANCELLED">Canceladas</option>
			</select>
		</div>

		<div id="all-bookings-content" class="table-container">
			<div class="loading-state">
				<div class="skeleton-card"></div>
			</div>
		</div>
	`;

	const contentDiv = container.querySelector<HTMLDivElement>(
		"#all-bookings-content",
	);
	const statusSelect =
		container.querySelector<HTMLSelectElement>("#status-filter");
	const refreshBtn =
		container.querySelector<HTMLButtonElement>("#refresh-all-btn");

	let cachedBookings: Booking[] = [];

	const loadData = async () => {
		if (!contentDiv) return;
		contentDiv.innerHTML = `
			<div class="loading-state">
				<div class="skeleton-card"></div>
			</div>
		`;

		try {
			cachedBookings = await fetchAllBookings();
			applyFilter();
		} catch (err: unknown) {
			contentDiv.innerHTML = `
				<div class="card error-state">
					<div class="error-icon">⚠️</div>
					<h3 class="error-title">Error al cargar reservaciones</h3>
					<p class="error-desc">${err instanceof Error ? err.message : "Error desconocido"}</p>
				</div>
			`;
		}
	};

	const applyFilter = () => {
		if (!contentDiv) return;
		const filter = statusSelect?.value || "ALL";

		const filtered =
			filter === "ALL"
				? cachedBookings
				: cachedBookings.filter((b) => b.booking_status === filter);

		if (filtered.length === 0) {
			contentDiv.innerHTML = `
				<div class="card empty-state">
					<div class="empty-icon">🔍</div>
					<h3 class="empty-title">Sin resultados</h3>
					<p class="empty-desc">No se encontraron reservaciones con el filtro seleccionado.</p>
				</div>
			`;
			return;
		}

		contentDiv.innerHTML = `
			<div class="bookings-table-wrapper">
				<table class="bookings-table">
					<thead>
						<tr>
							<th>Folio</th>
							<th>Paciente</th>
							<th>Servicio</th>
							<th>Horario</th>
							<th>Monto</th>
							<th>Estado</th>
							<th>Pago</th>
							<th>Google Cal</th>
						</tr>
					</thead>
					<tbody>
						${filtered
							.map(
								(b) => `
							<tr>
								<td class="font-mono font-bold">${b.booking_code}</td>
								<td>
									<div class="font-medium">${b.client_name || "Cliente"}</div>
									<div class="text-xs text-muted">📱 ${b.client_phone || ""}</div>
								</td>
								<td>${b.service_name || "Consulta"}</td>
								<td>${formatDateTime(b.scheduled_at)}</td>
								<td class="font-bold">${formatCurrency(b.amount_mxn)}</td>
								<td>${renderBookingStatusBadge(b.booking_status)}</td>
								<td>${renderPaymentStatusBadge(b.payment_status, b.payment_arrangement)}</td>
								<td>${renderCalendarSyncBadge(b.gcal_sync_status, b.id)}</td>
							</tr>
						`,
							)
							.join("")}
					</tbody>
				</table>
			</div>
		`;
	};

	statusSelect?.addEventListener("change", () => applyFilter());
	refreshBtn?.addEventListener("click", () => loadData());
	loadData();
}
