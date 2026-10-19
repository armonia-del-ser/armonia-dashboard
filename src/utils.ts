export function formatDateTime(isoStr: string): string {
	try {
		const dt = new Date(isoStr);
		if (Number.isNaN(dt.getTime())) return isoStr;
		return new Intl.DateTimeFormat("es-MX", {
			weekday: "short",
			day: "numeric",
			month: "short",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		}).format(dt);
	} catch {
		return isoStr;
	}
}

export function formatTimeOnly(isoStr: string): string {
	try {
		const dt = new Date(isoStr);
		if (Number.isNaN(dt.getTime())) return isoStr;
		return new Intl.DateTimeFormat("es-MX", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		}).format(dt);
	} catch {
		return isoStr;
	}
}

export function formatCurrency(amount: number): string {
	return `$${amount.toLocaleString("es-MX")} MXN`;
}

export function calculateInterval(
	startIso: string,
	durationMinutes: number,
	bufferMinutes: number,
): {
	start: Date;
	end: Date;
	bufferEnd: Date;
	startStr: string;
	endStr: string;
	bufferEndStr: string;
} {
	const start = new Date(startIso);
	const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
	const bufferEnd = new Date(end.getTime() + bufferMinutes * 60 * 1000);

	return {
		start,
		end,
		bufferEnd,
		startStr: formatTimeOnly(start.toISOString()),
		endStr: formatTimeOnly(end.toISOString()),
		bufferEndStr: formatTimeOnly(bufferEnd.toISOString()),
	};
}

export function getHoursRemainingBadge(hours: number): {
	text: string;
	urgencyClass: string;
} {
	if (hours <= 0) {
		return { text: "Sesión vencida / Hoy", urgencyClass: "badge-danger" };
	}
	if (hours <= 24) {
		return {
			text: `${Math.round(hours)}h restantes (Urgente)`,
			urgencyClass: "badge-danger",
		};
	}
	if (hours <= 48) {
		return {
			text: `${Math.round(hours)}h restantes`,
			urgencyClass: "badge-warning",
		};
	}
	return {
		text: `En ${Math.round(hours / 24)} días`,
		urgencyClass: "badge-info",
	};
}

export function isSameDay(d1: Date, d2: Date): boolean {
	return (
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate()
	);
}

export function isToday(date: Date, refDate: Date = new Date()): boolean {
	return isSameDay(date, refDate);
}

export function isTomorrow(date: Date, refDate: Date = new Date()): boolean {
	const tomorrow = new Date(
		refDate.getFullYear(),
		refDate.getMonth(),
		refDate.getDate() + 1,
	);
	return isSameDay(date, tomorrow);
}

export function isThisWeek(date: Date, refDate: Date = new Date()): boolean {
	const day = refDate.getDay();
	// Week starts on Monday: (day + 6) % 7 gives 0 for Monday, 6 for Sunday
	const diffToMonday = (day + 6) % 7;
	const startOfWeek = new Date(
		refDate.getFullYear(),
		refDate.getMonth(),
		refDate.getDate() - diffToMonday,
		0,
		0,
		0,
		0,
	);
	const endOfWeek = new Date(
		startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1,
	);
	return date >= startOfWeek && date <= endOfWeek;
}

export function formatDateInput(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export interface CollisionResult {
	hasCollision: boolean;
	isDirectCollision: boolean;
	isBufferCollision: boolean;
	deficitMinutes: number;
}

export function checkBufferCollision(
	currentStartIso: string,
	currentDurationMinutes: number,
	currentBufferMinutes: number,
	nextStartIso: string,
): CollisionResult {
	const currentStart = new Date(currentStartIso);
	const currentEnd = new Date(
		currentStart.getTime() + currentDurationMinutes * 60 * 1000,
	);
	const currentBufferEnd = new Date(
		currentEnd.getTime() + currentBufferMinutes * 60 * 1000,
	);
	const nextStart = new Date(nextStartIso);

	if (nextStart >= currentBufferEnd) {
		return {
			hasCollision: false,
			isDirectCollision: false,
			isBufferCollision: false,
			deficitMinutes: 0,
		};
	}

	const isDirectCollision = nextStart < currentEnd;
	const deficitMs = currentBufferEnd.getTime() - nextStart.getTime();
	const deficitMinutes = Math.round(deficitMs / (60 * 1000));

	return {
		hasCollision: true,
		isDirectCollision,
		isBufferCollision: !isDirectCollision,
		deficitMinutes,
	};
}

export function formatMexicanPhone(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return "";
	// Strip all non-digit characters
	const digits = trimmed.replace(/\D/g, "");
	// If 10 digits (Mexican national format, e.g. 5512345678)
	if (digits.length === 10) {
		return `+52 ${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
	}
	// If 12 digits starting with 52
	if (digits.length === 12 && digits.startsWith("52")) {
		const national = digits.slice(2);
		return `+52 ${national.slice(0, 2)} ${national.slice(2, 6)} ${national.slice(6)}`;
	}
	// Otherwise return input as-is or cleaned
	return trimmed;
}

export function getCleanDigitsPhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	if (digits.length === 10) return `52${digits}`;
	return digits;
}

export function getRoleBadge(role: "OWNER" | "ASSISTANT" | string): {
	label: string;
	roleClass: string;
} {
	if (role === "OWNER") {
		return { label: "Titular", roleClass: "role-owner" };
	}
	if (role === "ASSISTANT") {
		return { label: "Asistente", roleClass: "role-assistant" };
	}
	return { label: role || "Operador", roleClass: "role-fallback" };
}

export function debounce<Args extends unknown[]>(
	fn: (...args: Args) => void,
	delayMs = 250,
): (...args: Args) => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return (...args: Args) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			fn(...args);
		}, delayMs);
	};
}
