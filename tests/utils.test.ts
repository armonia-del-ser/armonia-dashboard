import { describe, expect, it } from "vitest";
import {
	calculateInterval,
	checkBufferCollision,
	debounce,
	formatCurrency,
	formatDateInput,
	formatMexicanPhone,
	getCleanDigitsPhone,
	getHoursRemainingBadge,
	getRoleBadge,
	isSameDay,
	isThisWeek,
	isToday,
	isTomorrow,
} from "../src/utils";

describe("Frontend Utilities", () => {
	it("formats MXN currency properly", () => {
		expect(formatCurrency(600)).toBe("$600 MXN");
		expect(formatCurrency(1250)).toContain("1,250");
	});

	it("computes appointment interval with mandatory buffer block", () => {
		const startIso = "2026-10-25T10:00:00.000Z";
		const interval = calculateInterval(startIso, 60, 15);

		expect(interval.start.getTime()).toBe(new Date(startIso).getTime());
		// 60 minutes session end
		expect(interval.end.getTime()).toBe(
			new Date(startIso).getTime() + 60 * 60 * 1000,
		);
		// 15 minutes buffer end
		expect(interval.bufferEnd.getTime()).toBe(
			new Date(startIso).getTime() + 75 * 60 * 1000,
		);
	});

	it("returns correct urgency badges based on hours remaining", () => {
		expect(getHoursRemainingBadge(0).urgencyClass).toBe("badge-danger");
		expect(getHoursRemainingBadge(12).urgencyClass).toBe("badge-danger");
		expect(getHoursRemainingBadge(36).urgencyClass).toBe("badge-warning");
		expect(getHoursRemainingBadge(72).urgencyClass).toBe("badge-info");
	});

	describe("Date Filtering Utilities", () => {
		const baseDate = new Date("2026-10-20T10:00:00");

		it("correctly identifies same calendar day", () => {
			const sameDay = new Date("2026-10-20T18:30:00");
			const diffDay = new Date("2026-10-21T10:00:00");
			expect(isSameDay(baseDate, sameDay)).toBe(true);
			expect(isSameDay(baseDate, diffDay)).toBe(false);
		});

		it("identifies today and tomorrow relative to reference date", () => {
			const todayAppointment = new Date("2026-10-20T15:00:00");
			const tomorrowAppointment = new Date("2026-10-21T11:00:00");
			const nextWeekAppointment = new Date("2026-10-28T11:00:00");

			expect(isToday(todayAppointment, baseDate)).toBe(true);
			expect(isToday(tomorrowAppointment, baseDate)).toBe(false);

			expect(isTomorrow(tomorrowAppointment, baseDate)).toBe(true);
			expect(isTomorrow(todayAppointment, baseDate)).toBe(false);

			expect(isThisWeek(todayAppointment, baseDate)).toBe(true);
			expect(isThisWeek(tomorrowAppointment, baseDate)).toBe(true);
			expect(isThisWeek(nextWeekAppointment, baseDate)).toBe(false);
		});

		it("formats date to YYYY-MM-DD input string", () => {
			const testDate = new Date(2026, 9, 20); // October 20, 2026
			expect(formatDateInput(testDate)).toBe("2026-10-20");
		});
	});

	describe("Collision Detection Utilities", () => {
		it("detects no collision when next appointment starts after buffer", () => {
			const startIso = "2026-10-20T10:00:00";
			const nextStartIso = "2026-10-20T11:15:00"; // Exactly after 60m + 15m buffer
			const result = checkBufferCollision(startIso, 60, 15, nextStartIso);

			expect(result.hasCollision).toBe(false);
			expect(result.deficitMinutes).toBe(0);
		});

		it("detects buffer collision when next appointment invades buffer window", () => {
			const startIso = "2026-10-20T10:00:00";
			const nextStartIso = "2026-10-20T11:05:00"; // 5 min into 15m buffer (10 min deficit)
			const result = checkBufferCollision(startIso, 60, 15, nextStartIso);

			expect(result.hasCollision).toBe(true);
			expect(result.isBufferCollision).toBe(true);
			expect(result.isDirectCollision).toBe(false);
			expect(result.deficitMinutes).toBe(10);
		});

		it("detects direct collision when next appointment starts before session ends", () => {
			const startIso = "2026-10-20T10:00:00";
			const nextStartIso = "2026-10-20T10:45:00"; // 15 min before session ends
			const result = checkBufferCollision(startIso, 60, 15, nextStartIso);

			expect(result.hasCollision).toBe(true);
			expect(result.isDirectCollision).toBe(true);
			expect(result.deficitMinutes).toBe(30); // 15 min session + 15 min buffer
		});
	});

	describe("Phone and WhatsApp Utilities", () => {
		it("formats 10-digit national number to Mexican international format (+52)", () => {
			expect(formatMexicanPhone("5512345678")).toBe("+52 55 1234 5678");
			expect(formatMexicanPhone("55-1234-5678")).toBe("+52 55 1234 5678");
			expect(formatMexicanPhone("(55) 1234 5678")).toBe("+52 55 1234 5678");
		});

		it("formats 12-digit number with 52 prefix correctly", () => {
			expect(formatMexicanPhone("525512345678")).toBe("+52 55 1234 5678");
			expect(formatMexicanPhone("+525512345678")).toBe("+52 55 1234 5678");
		});

		it("returns empty string on empty input", () => {
			expect(formatMexicanPhone("")).toBe("");
			expect(formatMexicanPhone("   ")).toBe("");
		});

		it("cleans phone digits for wa.me links", () => {
			expect(getCleanDigitsPhone("5512345678")).toBe("525512345678");
			expect(getCleanDigitsPhone("+52 55 1234 5678")).toBe("525512345678");
			expect(getCleanDigitsPhone("525512345678")).toBe("525512345678");
		});
	});

	describe("Operator Role Badges", () => {
		it("maps OWNER to Titular with role-owner class", () => {
			const badge = getRoleBadge("OWNER");
			expect(badge.label).toBe("Titular");
			expect(badge.roleClass).toBe("role-owner");
		});

		it("maps ASSISTANT to Asistente with role-assistant class", () => {
			const badge = getRoleBadge("ASSISTANT");
			expect(badge.label).toBe("Asistente");
			expect(badge.roleClass).toBe("role-assistant");
		});

		it("falls back gracefully for unknown roles", () => {
			const badge = getRoleBadge("UNKNOWN");
			expect(badge.label).toBe("UNKNOWN");
			expect(badge.roleClass).toBe("role-fallback");
		});
	});

	describe("Debounce Utility", () => {
		it("debounces calls within timeout", async () => {
			let counter = 0;
			const fn = debounce(() => {
				counter++;
			}, 50);

			fn();
			fn();
			fn();
			expect(counter).toBe(0);

			await new Promise((resolve) => setTimeout(resolve, 80));
			expect(counter).toBe(1);
		});
	});
});
