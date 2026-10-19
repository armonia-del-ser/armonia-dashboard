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
