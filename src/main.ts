import "./style.css";
import { fetchFollowUpQueue } from "./api";
import { renderAllBookings } from "./components/AllBookings";
import { renderDailyAgenda } from "./components/DailyAgenda";
import { renderFollowUpQueue } from "./components/FollowUpQueue";

type TabId = "queue" | "agenda" | "all";

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
		await this.refreshTabBadge();
		const hash = window.location.hash.replace("#", "") as TabId;
		const initialTab = hash === "agenda" || hash === "all" ? hash : "queue";
		this.switchTab(initialTab);
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
				<div class="operator-profile">
					<div class="operator-badge">
						<span class="status-dot"></span>
						<span>Jasmin & Asistente</span>
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
				<button class="mobile-nav-item" data-tab="all" role="tab" aria-selected="false">
					<span class="mobile-nav-icon" aria-hidden="true">📋</span>
					<span class="mobile-nav-label">Historial</span>
				</button>
			</nav>
		`;
	}

	private bindEvents(): void {
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

		window.addEventListener("hashchange", () => {
			const hash = window.location.hash.replace("#", "") as TabId;
			if (hash === "queue" || hash === "agenda" || hash === "all") {
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
