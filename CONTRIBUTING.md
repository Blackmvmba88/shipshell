# Contributing to ShipShell

ShipShell is at the foundation stage. Contributions should preserve its trust model.

1. Create a focused branch.
2. Keep secrets and runtime evidence out of Git.
3. Add tests for decision, permission, or persistence changes.
4. Run `npm run check`.
5. Explain any new external side effect and where ShipSeal approval occurs.

Changes that silently publish, purchase, delete, push, alter accounts, or bypass approval boundaries will not be accepted.
