import { describe, expect, it } from "vitest";
import {
	buildWhatsAppUrl,
	disambiguate409Error,
	escapeHtml,
	formatRosterCapacity,
	reconcileAlreadyCheckedInState,
	reconcileSessionsWithServer,
	renderAttendanceStatusBadge,
	renderPaymentStatusPill,
} from "../src/components/WorkshopRoster";
import type { RosterAttendee, RosterSession } from "../src/types";

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

	describe("HTML Sanitization (escapeHtml)", () => {
		it("escapes dangerous HTML characters to prevent XSS", () => {
			expect(escapeHtml('<script>alert("xss")</script>')).toBe(
				"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
			);
			expect(escapeHtml("Tom & Jerry's")).toBe("Tom &amp; Jerry&#039;s");
			expect(escapeHtml('<img src="x" onerror="alert(1)">')).toBe(
				"&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;",
			);
		});

		it("leaves strings without special characters untouched", () => {
			expect(escapeHtml("Elena Gómez")).toBe("Elena Gómez");
			expect(escapeHtml("ADS-1001")).toBe("ADS-1001");
			expect(escapeHtml("+52 55 1111 2222")).toBe("+52 55 1111 2222");
		});
	});

	describe("409 Out-of-Band Counter Reconciliation", () => {
		function createMockSession(occupied = 2, attended = 0): RosterSession {
			return {
				service_id: "srv-123",
				service_name: "Círculo de Cacao",
				scheduled_at: "2026-10-26T18:00:00Z",
				max_capacity: 15,
				occupied_count: occupied,
				attended_count: attended,
				attendees: [],
			};
		}

		function createMockAttendee(attended = false): RosterAttendee {
			return {
				booking_id: "bk-123",
				booking_code: "ADS-1001",
				client_id: "cl-123",
				client_name: "Elena Gómez",
				client_phone: "525511112222",
				booking_status: attended ? "COMPLETED" : "RESERVED",
				payment_arrangement: "PREPAID_DEFAULT",
				payment_status: "ACKNOWLEDGED",
				amount_mxn: 350,
				attended,
			};
		}

		it("increments attended_count and reconciles attendee when locally unrecorded", () => {
			const session = createMockSession(2, 0);
			const attendee = createMockAttendee(false);

			const incremented = reconcileAlreadyCheckedInState(session, attendee);

			expect(incremented).toBe(true);
			expect(session.attended_count).toBe(1);
			expect(attendee.attended).toBe(true);
			expect(attendee.booking_status).toBe("COMPLETED");
		});

		it("does not increment attended_count if attendee was already marked attended locally", () => {
			const session = createMockSession(2, 1);
			const attendee = createMockAttendee(true);

			const incremented = reconcileAlreadyCheckedInState(session, attendee);

			expect(incremented).toBe(false);
			expect(session.attended_count).toBe(1); // Unchanged
			expect(attendee.attended).toBe(true);
		});

		it("reconciles multiple out-of-band check-ins authoritatively from server response (Case 2B)", () => {
			const staleLocalSession: RosterSession = {
				service_id: "srv-123",
				service_name: "Círculo de Cacao",
				scheduled_at: "2026-10-26T18:00:00Z",
				max_capacity: 15,
				occupied_count: 2,
				attended_count: 0,
				attendees: [
					{
						booking_id: "bk-1001",
						booking_code: "ADS-1001",
						client_id: "cl-1",
						client_name: "Elena Gómez",
						client_phone: "525511112222",
						booking_status: "RESERVED",
						payment_arrangement: "PREPAID_DEFAULT",
						payment_status: "ACKNOWLEDGED",
						amount_mxn: 350,
						attended: false,
					},
					{
						booking_id: "bk-1002",
						booking_code: "ADS-1002",
						client_id: "cl-2",
						client_name: "Carlos Méndez",
						client_phone: "525533334444",
						booking_status: "RESERVED",
						payment_arrangement: "PREPAID_DEFAULT",
						payment_status: "AWAITING_ACKNOWLEDGMENT",
						amount_mxn: 350,
						attended: false,
					},
				],
			};

			const authoritativeServerSession: RosterSession = {
				service_id: "srv-123",
				service_name: "Círculo de Cacao",
				scheduled_at: "2026-10-26T18:00:00Z",
				max_capacity: 15,
				occupied_count: 2,
				attended_count: 2,
				attendees: [
					{
						booking_id: "bk-1001",
						booking_code: "ADS-1001",
						client_id: "cl-1",
						client_name: "Elena Gómez",
						client_phone: "525511112222",
						booking_status: "COMPLETED",
						payment_arrangement: "PREPAID_DEFAULT",
						payment_status: "ACKNOWLEDGED",
						amount_mxn: 350,
						attended: true,
					},
					{
						booking_id: "bk-1002",
						booking_code: "ADS-1002",
						client_id: "cl-2",
						client_name: "Carlos Méndez",
						client_phone: "525533334444",
						booking_status: "COMPLETED",
						payment_arrangement: "PREPAID_DEFAULT",
						payment_status: "ACKNOWLEDGED",
						amount_mxn: 350,
						attended: true,
					},
				],
			};

			const reconciled = reconcileSessionsWithServer(
				[staleLocalSession],
				[authoritativeServerSession],
			);

			expect(reconciled).toHaveLength(1);
			expect(reconciled[0].occupied_count).toBe(2);
			expect(reconciled[0].attended_count).toBe(2);

			const elena = reconciled[0].attendees.find(
				(a) => a.booking_code === "ADS-1001",
			);
			const carlos = reconciled[0].attendees.find(
				(a) => a.booking_code === "ADS-1002",
			);

			expect(elena?.attended).toBe(true);
			expect(elena?.booking_status).toBe("COMPLETED");

			expect(carlos?.attended).toBe(true);
			expect(carlos?.booking_status).toBe("COMPLETED");
		});
	});
});
