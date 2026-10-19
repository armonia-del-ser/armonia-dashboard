import "./style.css";
import { fetchCurrentAdmin, fetchFollowUpQueue } from "./api";
import { renderAllBookings } from "./components/AllBookings";
import { renderClientDirectory } from "./components/ClientDirectory";
import { renderDailyAgenda } from "./components/DailyAgenda";
import { renderFollowUpQueue } from "./components/FollowUpQueue";
import { openBookingIntakeModal } from "./components/IntakeModal";
import { getRoleBadge } from "./utils";

type TabId = "queue" | "agenda" | "clients" | "all";

class OperatorDashboardApp {
	private activeTab: TabId = "queue";
	private container: HTMLElement;

	public get currentTab(): TabId {
		return this.activeTab;
	}

	constructor(container: HTMLElement) {
		this.container = container;
		this.init();
	}

	private async init(): Promise<void> {
		this.renderShell();
		this.bindEvents();
		await Promise.allSettled([
			this.loadOperatorIdentity(),
			this.refreshTabBadge(),
		]);
		const hash = window.location.hash.replace("#", "") as TabId | "nueva-cita";
		if (hash === "nueva-cita") {
			this.switchTab("agenda");
			openBookingIntakeModal({
				onSuccess: async () => {
					await this.refreshTabBadge();
					this.switchTab(this.activeTab);
				},
			});
		} else {
			const initialTab =
				hash === "agenda" || hash === "clients" || hash === "all"
					? hash
					: "queue";
			this.switchTab(initialTab);
		}
	}

	private renderShell(): void {
		this.container.innerHTML = `
			<header class="app-header">
				<div class="brand-section">
					<span class="brand-lotus" aria-hidden="true">🪷</span>
					<div>
						<h1 class="brand-title">Armonía del Ser</h1>
						<div class="text-xs text-muted">Panel Operativo de Consultas y Agenda</div>
					</div>
					<span class="brand-badge">Operador</span>
				</div>

				<div class="header-actions">
					<button
						id="global-new-booking-btn"
						class="btn btn-primary btn-new-booking"
						type="button"
						title="Registrar una nueva reservación de consulta"
					>
						<span>＋ Nueva Cita</span>
					</button>

					<div id="operator-profile" class="operator-profile" aria-live="polite">
						<div class="operator-badge operator-badge-loading">
							<span class="status-dot status-dot-pulse"></span>
							<span class="operator-name-text">Cargando operador...</span>
						</div>
					</div>
				</div>
			</header>

			<!-- Desktop & Tablet Tabs Header -->
			<nav class="nav-tabs" role="tablist" aria-label="Navegación principal">
				<button class="nav-tab active" data-tab="queue" role="tab" aria-selected="true">
					<span>Cola 48h (Seguimiento)</span>
					<span id="queue-badge" class="tab-badge hidden">0</span>
				</button>
				<button class="nav-tab" data-tab="agenda" role="tab" aria-selected="false">
					<span>Agenda del Día (Buffers)</span>
				</button>
				<button class="nav-tab" data-tab="clients" role="tab" aria-selected="false">
					<span>Clientes</span>
				</button>
				<button class="nav-tab" data-tab="all" role="tab" aria-selected="false">
					<span>Todas las Citas</span>
				</button>
			</nav>

			<!-- Main View Container -->
			<main id="tab-content" class="tab-main-content" role="tabpanel"></main>

			<!-- Sticky Mobile Navigation Bar -->
			<nav class="mobile-sticky-nav" role="tablist" aria-label="Navegación móvil rápida">
				<button class="mobile-nav-item active" data-tab="queue" role="tab" aria-selected="true">
					<span class="mobile-nav-icon" aria-hidden="true">⏱️</span>
					<span class="mobile-nav-label">Cola 48h</span>
					<span id="queue-badge-mobile" class="tab-badge tab-badge-mobile hidden">0</span>
				</button>
				<button class="mobile-nav-item" data-tab="agenda" role="tab" aria-selected="false">
					<span class="mobile-nav-icon" aria-hidden="true">📅</span>
					<span class="mobile-nav-label">Agenda</span>
				</button>
				<button class="mobile-nav-item" data-tab="clients" role="tab" aria-selected="false">
					<span class="mobile-nav-icon" aria-hidden="true">👥</span>
					<span class="mobile-nav-label">Clientes</span>
				</button>
				<button class="mobile-nav-item" data-tab="all" role="tab" aria-selected="false">
					<span class="mobile-nav-icon" aria-hidden="true">📋</span>
					<span class="mobile-nav-label">Historial</span>
				</button>
			</nav>
		`;
	}

	private async loadOperatorIdentity(): Promise<void> {
		const profileEl =
			this.container.querySelector<HTMLElement>("#operator-profile");
		if (!profileEl) return;

		try {
			const admin = await fetchCurrentAdmin();
			const roleInfo = getRoleBadge(admin.role);

			profileEl.innerHTML = `
				<div class="operator-badge operator-badge-authenticated" title="Sesión activa: ${admin.email}">
					<span class="status-dot status-dot-online"></span>
					<span class="operator-name font-medium">${admin.full_name}</span>
					<span class="operator-role-pill ${roleInfo.roleClass}">
						${roleInfo.label}
					</span>
				</div>
			`;
		} catch {
			// Graceful fallback if unauthorized or loading error
			profileEl.innerHTML = `
				<div class="operator-badge operator-badge-fallback" title="Sesión local o sin conexión">
					<span class="status-dot status-dot-offline"></span>
					<span class="operator-name">Jasmin & Asistente</span>
					<span class="operator-role-pill role-fallback">Local</span>
				</div>
			`;
		}
	}

	private bindEvents(): void {
		// New Booking Button
		const newBookingBtn = this.container.querySelector<HTMLButtonElement>(
			"#global-new-booking-btn",
		);
		newBookingBtn?.addEventListener("click", () => {
			openBookingIntakeModal({
				onSuccess: async () => {
					await this.refreshTabBadge();
					// Refresh current view
					this.switchTab(this.activeTab);
				},
			});
		});

		// Tab Switching Buttons
		const allTabButtons =
			this.container.querySelectorAll<HTMLButtonElement>("[data-tab]");
		allTabButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const targetTab = btn.getAttribute("data-tab") as TabId;
				if (targetTab) {
					this.switchTab(targetTab);
				}
			});
		});

		// Hash routing
		window.addEventListener("hashchange", () => {
			const hash = window.location.hash.replace("#", "") as TabId;
			if (
				hash === "queue" ||
				hash === "agenda" ||
				hash === "clients" ||
				hash === "all"
			) {
				if (this.activeTab !== hash) {
					this.switchTab(hash);
				}
			}
		});
	}

	private switchTab(tab: TabId): void {
		this.activeTab = tab;
		window.location.hash = tab;

		// Update both desktop and mobile active states
		const allTabButtons =
			this.container.querySelectorAll<HTMLButtonElement>("[data-tab]");
		allTabButtons.forEach((btn) => {
			const isCurrent = btn.getAttribute("data-tab") === tab;
			btn.classList.toggle("active", isCurrent);
			btn.setAttribute("aria-selected", isCurrent ? "true" : "false");
		});

		// Render tab view
		const contentEl = this.container.querySelector<HTMLElement>("#tab-content");
		if (!contentEl) return;

		const onStateChange = async () => {
			await this.refreshTabBadge();
		};

		if (tab === "queue") {
			renderFollowUpQueue(contentEl, onStateChange);
		} else if (tab === "agenda") {
			renderDailyAgenda(contentEl, onStateChange);
		} else if (tab === "clients") {
			renderClientDirectory(contentEl, onStateChange);
		} else if (tab === "all") {
			renderAllBookings(contentEl);
		}
	}

	private async refreshTabBadge(): Promise<void> {
		try {
			const queue = await fetchFollowUpQueue();
			const count = queue.length;
			const badges = this.container.querySelectorAll<HTMLSpanElement>(
				"#queue-badge, #queue-badge-mobile",
			);
			badges.forEach((badge) => {
				if (count > 0) {
					badge.textContent = String(count);
					badge.classList.remove("hidden");
				} else {
					badge.classList.add("hidden");
				}
			});
		} catch {
			// Ignore badge background fetch failure
		}
	}
}

const appRoot = document.getElementById("app");
if (appRoot) {
	new OperatorDashboardApp(appRoot);
}
