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
					<span class="brand-lotus">🪷</span>
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

			<nav class="nav-tabs" role="tablist">
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

			<main id="tab-content" class="tab-main-content" role="tabpanel"></main>
		`;
	}

	private bindEvents(): void {
		const tabButtons =
			this.container.querySelectorAll<HTMLButtonElement>(".nav-tab");
		tabButtons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const targetTab = btn.getAttribute("data-tab") as TabId;
				if (targetTab) {
					this.switchTab(targetTab);
				}
			});
		});
	}

	private switchTab(tab: TabId): void {
		this.activeTab = tab;

		// Update tab button active states
		const tabButtons =
			this.container.querySelectorAll<HTMLButtonElement>(".nav-tab");
		tabButtons.forEach((btn) => {
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
			const badge =
				this.container.querySelector<HTMLSpanElement>("#queue-badge");
			if (badge) {
				if (queue.length > 0) {
					badge.textContent = String(queue.length);
					badge.classList.remove("hidden");
				} else {
					badge.classList.add("hidden");
				}
			}
		} catch {
			// Ignore badge background fetch failure
		}
	}
}

const appRoot = document.getElementById("app");
if (appRoot) {
	new OperatorDashboardApp(appRoot);
}
