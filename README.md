# Action Inbox — runnable public demo

A local, interactive demonstration of turning unstructured inbox messages into reviewable actions with explicit approval and execution controls. This privacy-safe public version uses a deterministic planner and seven fictional messages; the private project also includes local-model planning, inbox integrations and a broader evaluation suite. Execution in this demo is simulated.

## Run

Requires Node.js 22.12 or later and npm. From this folder:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:3000**. No accounts, credentials, environment files, model downloads, database or external services are required. Installation downloads open-source dependencies; the demo itself makes only same-origin application requests. The development server listens on loopback.

For a production build:

```sh
npm run build
npm start
```

## Try it in two minutes

1. Select **AI workshop timing**. One message produces both a meeting change and a to-do.
2. Review the suggestion and click **Approve**. Nothing executes yet.
3. Click **Change**, edit a material detail, and save. Approval is withdrawn automatically.
4. Approve again, then click **Simulate action**. The result and Activity panel identify it as simulated.
5. Select **Catch up?** to see clarification for missing details.
6. Select **RE: Contract review — urgent** to see a synthetic prompt-injection attempt flagged without gaining approval authority.
7. Open **Settings → Reset demo** to start again.

The original sample text is available under **Read original sample message**. The layout supports desktop and narrow screens.

## What this demonstrates

Validation: 156 automated tests passed, alongside type checking, linting, production build, HTTP workflow and privacy checks.

- A typed planner boundary with schema validation; planner output cannot set approval or execution state.
- A deterministic state machine and approval bound to the reviewed payload with an ephemeral server-side signature.
- Material edits revoke approval. Execution checks the server-held action and rejects forged, missing or stale approvals.
- A separate simulated connector and an activity trail. Duplicate concurrent execution is refused.
- Editable suggestions, clarification, rejection and synthetic adversarial examples.

## Scope and limitations

This is a self-contained public demo of the action-review workspace, not the full private product. It excludes live inbox briefing, Google/OAuth integration, paid providers, local-model integration and private evaluation logs. The rules-based planner is deliberately limited; this demo does not claim measured LLM quality or production readiness.

All demo state lives in server memory, shared across tabs on this local server. Reset or restart clears it; there is no database or disk outbox. The bundled inbox remains available. The API accepts only known sample message IDs for analysis. Edits are for experimenting with fictional data. There is no authentication or multi-user isolation; run locally as intended.

## Verify

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run privacy:check
```

With the demo running, verify the HTTP workflow in another terminal:

```sh
npm run test:smoke
```

Tests cover state transitions, approval binding, malformed planner output, prompt injection, multiple actions, the sample-only API, editing, reset and simulated execution. The privacy scanner checks distributable text and app capabilities; dependencies and generated build files are excluded.

See **INCLUDED-FILES.md** for the exact upload inventory and **VALIDATION.md** for checks performed on this package. Upload this folder's contents while preserving subfolders. Do not upload generated `node_modules/`, `.next/` or local environment files.
