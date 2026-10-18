# Armonía del Ser: Admin Dashboard (`armonia-dashboard`)

Mobile-first operational dashboard for **Jazmín**, owner of **Armonía del Ser**.

Designed to streamline schedule coordination, client directory tracking, and instant 1-tap SPEI payment acknowledgment without friction.

---

## The Operational Problem Solved

Currently, Jazmín coordinates bookings via manual chat messages and allows clients to pay after sessions, leading to lost revenue when clients stop responding.

`armonia-dashboard` equips Jazmín with a dedicated, mobile-optimized tool where she can:
1. **Acknowledge Payments in 1 Tap**: When an SPEI deposit notification appears in her banking app matching a reservation folio (`ADS-XXXX`), she taps "Confirmar Pago" to transition the booking from `PENDING_PAYMENT` to `CONFIRMED`.
2. **Synchronize with Google Calendar**: View locked-in sessions alongside tentative holds.
3. **Contact Clients Directly**: One-touch WhatsApp triggers (`wa.me`) to send session reminders or meeting links.
4. **Manage Services**: Adjust pricing, schedules, and capacity limits (e.g., Círculos de Cacao, Meditaciones con cuencos, Atención Psicológica).

---

## Architectural Principles

- **Zero-Cost Deployment**: Designed for **Cloudflare Pages** (static edge delivery, $0/month).
- **Mobile Ergonomics**: Large touch targets (minimum 44x44px), thumb-friendly layout, and zero layout shift.
- **5-State Resilient UI**: Every component handles *Empty*, *Loading*, *Error*, *Partial*, and *Success* states gracefully.

---

## Local Development Quickstart

### Prerequisites
- Node.js 20+
- npm

### 1. Setup Environment
```bash
cp .env.example .env
```
Set `VITE_API_BASE_URL=http://localhost:8000` to connect to `armonia-api`.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Dev Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.