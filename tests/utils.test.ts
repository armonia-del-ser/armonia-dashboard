import { describe, expect, it } from "vitest";
import {
	calculateInterval,
	formatCurrency,
	getHoursRemainingBadge,
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
});
