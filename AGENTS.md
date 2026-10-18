# Armonía del Ser: Admin Dashboard - Agent Guidelines & Workflow Rules

This document specifies mandatory workflows, constraints, and quality gates for AI agents operating in `armonia-dashboard`.

---

## 1. Core Operating Constraints

- **No Direct Commits to `main`**: Agents must never commit directly to `main`. All work must be developed on descriptive feature, bugfix, or chore branches (`feat/*`, `fix/*`, `chore/*`).
- **No Destructive Git Actions**: Commands such as `git reset --hard`, `git restore <file>`, `git clean -fd`, and force-pushes (`git push --force`) are strictly prohibited without the user's explicit yes.
- **Secret Redaction**: Never print, commit, or log sensitive tokens or API credentials.
- **Session Modes**:
  - `learning`: The user drives and writes the reasoning, the agent asks guiding questions.
  - `delivery`: The agent may draft code and plans, presenting rationale and trade-offs.

---

## 2. Agent Directory & Persona Delegation

- **Anne Droid** (`profile/agents/anne-droid.md`): Senior Frontend Engineer & UX Specialist.
  - **Consult when**: Designing or reviewing mobile ergonomics, accessible form components, and booking state transitions.
  - **Delegate when**: Implementing UI components, Tailwind styling, and client-side interactions on `feat/anne/*` branches.
  - **Anti-"Zombie UI" Invariant**: Every view must explicitly design for the 5 states: *Empty*, *Loading*, *Error*, *Partial*, and *Success*. Touch targets must be >= 44x44px for thumb use on mobile devices.

---

## 3. Architecture & Functional Directives

- **Primary Persona**: Jazmín (therapist and business owner).
- **Core Ergonomic Requirement**: **Mobile-first**. Jazmín checks her banking app (BBVA) on her phone to see incoming SPEI notifications, then switches to the dashboard to tap "Acreditar Pago" in one touch.
- **Key Views**:
  1. *Agenda & Reservas*: Live list of pending vs confirmed bookings with filter toggles.
  2. *Validación de Pagos*: Fast-action review queue for incoming SPEI deposits matching folios (`ADS-XXXX`).
  3. *Directorio de Clientes*: Searchable directory with direct `wa.me` WhatsApp contact links.
  4. *Catálogo de Servicios*: Configuration of prices, schedules, and capacity.
