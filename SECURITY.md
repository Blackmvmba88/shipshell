# Security policy

## Current security model

ShipShell is an early local MVP. It is not yet intended for untrusted multi-user hosting.

- Bind the API to loopback only.
- Keep `.env.local`, `in documents`, and `.shipshell/` out of Git.
- Never expose the OpenAI key to the client or terminal processes.
- Execute terminal commands with `shell: false`.
- Permit only reviewed read-only commands during the MVP.
- Render remote sites with Node integration disabled, context isolation enabled, sandboxing enabled, and web security preserved.
- Keep the local shell locked to its deck URL and allow remote tabs to navigate only to HTTP(S) destinations.
- Apply a restrictive Content Security Policy to the local interface.
- Deny remote permission requests by default; add narrowly reviewed permissions later.
- Require a future ShipSeal approval flow before adding mutating commands.

## Reporting a vulnerability

Do not open a public issue containing secrets or exploit details. Contact the repository owner privately through GitHub before public disclosure.

## Out of scope for the MVP

- password storage
- payments or purchases
- automatic posting or account modification
- unattended destructive actions
- remote multi-user execution
