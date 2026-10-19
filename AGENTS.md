# Repository Technical Blueprint: `armonia-dashboard`

This file defines the local toolchain, frontend implementation rules, UX invariants, and security boundaries for `armonia-dashboard`. For cross-repo Git branching rules, TDD lifecycle, or Gitea (`tea`) issue tracking, consult the workspace root [`../AGENTS.md`](../AGENTS.md).

---

## 1. Local Toolchain & Nix Environment (`flake.nix` + `pnpm` + `Vite+` + `Biome`)

This repository is provisioned via a declarative Nix `devShell` (`flake.nix` + `.envrc`) and uses `pnpm`, `Vite+` (`vp`), and `Biome`.
- **Nix DevShell:** Ensure commands run inside the Nix environment (`direnv` activates automatically on `cd`, or prefix with `nix develop -c <cmd>`).
- **Package Manager:** Use `pnpm` exclusively (`pnpm install`, `pnpm add`). Never use `npm` or `yarn` (do not generate `package-lock.json` or `yarn.lock`).
- **Verification Gates (Pre-Commit Checklist):**
  Before proposing or executing any commit, run and pass all checks with zero warnings or errors:
  ```bash
  pnpm exec biome check .
  pnpm exec vp check
  pnpm exec vp test
  ```

---

## 2. Frontend Architecture & Persona Delegation

### Anne Droid Delegation (`profile/agents/anne-droid.md`)
- **Consult when:** Designing or reviewing mobile ergonomics, accessible form controls, and operator workflows for booking/payment state transitions.
- **Delegate when:** Implementing UI components, Tailwind CSS styling, HTMX/Vite+ client interactions, and frontend tests on `feat/anne/*` branches.

### UI & UX Invariants
- **5-State Resilient UI (Anti-"Zombie UI"):** Every operator view and interactive control must explicitly handle all 5 states: *Empty*, *Loading*, *Error*, *Partial* (e.g., booking saved in Turso but Google Calendar sync `FAILED`), and *Success*.
- **Mobile Ergonomics:** Designed mobile-first for Jasmin and her assistant operating on smartphones. All interactive touch targets must be $\ge 44\times 44\text{px}$ with zero layout shift.

### Security & API Boundary
- **Zero Client Secrets:** Never embed Google OAuth client secrets, Turso tokens, or session signing keys in frontend code or `VITE_*` environment variables. All authentication and `admin_allowlist` checks are enforced server-side by `armonia-api`.

---

## 3. Core Operator Views & Functional Scope

1. **Cola de Seguimiento (48h) & Pagos Pendientes:** Surfaces `RESERVED` bookings within 48 hours where `payment_status = 'AWAITING_ACKNOWLEDGMENT'` (plus any unpaid `DELAYED_ALLOWED` exceptions), providing 1-tap `wa.me` follow-up links and explicit operator actions:
   - **Acreditar Pago (`ACKNOWLEDGED`)**
   - **Autorizar Pago Diferido (`DELAYED_ALLOWED`)**
   - **Liberar Espacio (`RELEASED`)**
2. **Agenda & Sincronización con Google Calendar:** Displays unified booking (`booking_status`) and payment (`payment_arrangement`, `payment_status`) truth alongside Google Calendar sync status (`SYNCED` vs `FAILED` with 1-tap retry).
3. **Control de Paquetes & Asistencia:** Multi-session package progress tracker (e.g., `8 de 10`) and group workshop roster check-in.
4. **Catálogo de Servicios:** Administrative management of service modalities (`PRESENCIAL` / `ONLINE`), capacities, buffers, and MXN pricing.
