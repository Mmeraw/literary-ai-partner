## U2.1 Guardrails

Do not expand this PR beyond the first propagation-integrity slice.

- no UI work
- no DB schema changes
- no release-gate changes
- no new validity states
- no expansion into U2.2, U2.3, or U3
- no invented upstream signal if an existing one can be mapped cleanly
- no penalty for raw Pass 1 findings that were later resolved

Correctness hinge:

> “incomplete” means unresolved after downstream convergence/resolution,
> not merely observed in Pass 1.
