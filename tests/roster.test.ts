import { describe, expect, it } from "vitest";
import {
	buildWhatsAppUrl,
	disambiguate409Error,
	formatRosterCapacity,
	renderAttendanceStatusBadge,
	renderPaymentStatusPill,
} from "../src/components/WorkshopRoster";

describe("Workshop Roster Utilities", () => {
	describe("Capacity Formatting", () => {
		it("formats capacity counter accurately per spec", () => {
			expect(formatRosterCapacity(2, 15, 0)).toBe(
				"Ocupación: 2 / 15 (0 presentes)",
			);
			expect(formatRosterCapacity(2, 15, 1)).toBe(
				"Ocupación: 2 / 15 (1 presentes)",
			);
			expect(formatRosterCapacity(3, 15, 3)).toBe(
				"Ocupación: 3 / 15 (3 presentes)",
			);
		});
	});

	describe("Status Badges Rendering", () => {
		it("renders REGISTRADO when attended is false", () => {
			const badge = renderAttendanceStatusBadge(false, "RESERVED");
			expect(badge).toContain("REGISTRADO");
			expect(badge).toContain("status-roster-registered");
		});

		it("renders ASISTIÓ when attended is true or status is COMPLETED", () => {
			const badge1 = renderAttendanceStatusBadge(true, "COMPLETED");
			expect(badge1).toContain("ASISTIÓ");
			expect(badge1).toContain("status-roster-attended");

			const badge2 = renderAttendanceStatusBadge(false, "COMPLETED");
			expect(badge2).toContain("ASISTIÓ");
		});

		it("renders PAGADO when payment_status is ACKNOWLEDGED", () => {
			const badge = renderPaymentStatusPill("ACKNOWLEDGED");
			expect(badge).toContain("PAGADO");
			expect(badge).toContain("status-roster-paid");
		});

		it("renders PENDIENTE when payment_status is AWAITING_ACKNOWLEDGMENT", () => {
			const badge = renderPaymentStatusPill("AWAITING_ACKNOWLEDGMENT");
			expect(badge).toContain("PENDIENTE");
			expect(badge).toContain("status-roster-pending");
		});
	});

	describe("WhatsApp URL Generation", () => {
		it("generates 1-tap wa.me link with 10-digit number", () => {
			expect(buildWhatsAppUrl("5511112222")).toBe("https://wa.me/525511112222");
		});

		it("generates wa.me link with already prefixed 12-digit number", () => {
			expect(buildWhatsAppUrl("525533334444")).toBe(
				"https://wa.me/525533334444",
			);
		});

		it("cleans formatting characters in phone number", () => {
			expect(buildWhatsAppUrl("+52 55 9876 5432")).toBe(
				"https://wa.me/525598765432",
			);
		});
	});

	describe("409 Conflict Disambiguation", () => {
		it("identifies already checked in conflict", () => {
			expect(
				disambiguate409Error("This attendee has already checked in."),
			).toBe("ALREADY_CHECKED_IN");
		});

		it("identifies capacity reached conflict", () => {
			expect(
				disambiguate409Error(
					"El taller ha alcanzado su cupo máximo (15) para esta sesión.",
				),
			).toBe("CAPACITY_EXCEEDED");
		});

		it("identifies capacity reached without accent if encountered", () => {
			expect(
				disambiguate409Error(
					"El taller ha alcanzado su cupo maximo para esta sesión.",
				),
			).toBe("CAPACITY_EXCEEDED");
		});

		it("falls back to UNKNOWN for other 409 or empty messages", () => {
			expect(disambiguate409Error("Some generic conflict")).toBe("UNKNOWN");
			expect(disambiguate409Error(undefined)).toBe("UNKNOWN");
		});
	});
});
