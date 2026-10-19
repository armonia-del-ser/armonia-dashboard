# Armonía del Ser: Admin Dashboard (`armonia-dashboard`)

Mobile-first operational control surface for **Jasmin**, owner of **Armonía del Ser**, and her assistant.

Designed to provide single-source-of-truth visibility into bookings, 48-hour payment follow-ups, delayed-payment exceptions, deliberate slot releases, and Google Calendar coordination.

---

## The Operational Problem Solved

`armonia-dashboard` equips Jasmin and her assistant with an authenticated (`Google OAuth` + server-side Turso allowlist), mobile-optimized control surface where they can:
1. **Monitor the 48-Hour Payment Follow-Up Queue**: View active bookings within 48 hours of their session (or with authorized delayed payments) whose payments have not yet been acknowledged, and contact clients manually via 1-tap `wa.me` links.
2. **Acknowledge Payments (`ACKNOWLEDGED`)**: Record verified SPEI/cash deposits with full auditability (`acknowledged_by`, `acknowledged_at`).
3. **Authorize Delayed-Payment Exceptions (`DELAYED_ALLOWED`)**: Explicitly allow a session to proceed without prepayment while keeping the outstanding balance visible and traceable.
4. **Deliberately Release Slots (`RELEASED`)**: Release an unconfirmed slot after manual follow-up so another client can book the time.
5. **Coordinate with Google Calendar**: Inspect schedule synchronization status (`SYNCED` vs `FAILED`) and retry failed calendar syncs.

---

## Architectural Principles

- **Zero-Cost Deployment**: Designed for **Cloudflare Pages** (static edge delivery, $0/month).
- **Server-Enforced Security**: OAuth credentials and session signing secrets live strictly in `armonia-api`, verified on every request against Turso's `admin_allowlist`.
- **Mobile Ergonomics**: Large touch targets (minimum 44x44px), thumb-friendly layout, and zero layout shift.
- **5-State Resilient UI**: Every component handles *Empty*, *Loading*, *Error*, *Partial*, and *Success* states gracefully.

---

## Local Development Quickstart

### Prerequisites
- NixOS / Nix Flakes (`direnv` recommended) or Node.js 22+ & `pnpm`

### 1. Enter Nix DevShell & Setup Environment
```bash
direnv allow # or: nix develop
cp .env.example .env
```
Set `VITE_API_BASE_URL=http://localhost:8000` to connect to `armonia-api`.

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Run Dev Server (`Vite+`)
```bash
pnpm exec vp dev
```
Open `http://localhost:5173` in your browser.

### 4. Verification Gates
```bash
pnpm exec biome check .
pnpm exec vp check
pnpm exec vp test
```