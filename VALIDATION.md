# Validation record

Validated on 23 September 2026 (Europe/London) using Node.js 26.8.1 and npm 11.19.0 on macOS. Node.js 22.12+ is declared; other Node/OS combinations were not tested here.

| Check | Result |
| --- | --- |
| Fresh dependency installation | Passed: 447 packages installed in a separate validation copy |
| `npm test` | Passed: 156 tests across 8 test files |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed using Next.js 16.3.4 with webpack |
| `npm start` + HTTP smoke test | Passed |
| `npm run dev` + HTTP smoke test | Passed |
| Browser landing page | Loaded the labelled sample inbox and all seven messages |
| Complete automated browser click-through | Not completed: browser-control timeouts; covered instead by component tests and HTTP workflow checks |
| Final distributable privacy scan | Passed |
| Exact comparison against private credential/token/email values | No matching public files |
| Private project preservation | 349 snapshotted files unchanged; dependencies and build cache excluded from that snapshot |

The HTTP smoke test covers page rendering, listing all seven samples, rejecting pasted mail, analysis, pre-approval refusal, editing that revokes approval, re-approval, simulated execution, repeat-execution refusal, activity, injection detection, an absent Google connection endpoint, and reset.

The privacy scan covers every distributable text file, checks credential patterns and home-directory paths, rejects non-example email addresses, and checks application source for external URLs, environment configuration, filesystem/database modules and network clients. The additional private-value comparison was performed locally without printing or copying those values into this package. This is a scoped scan, not a formal security certification.

The default Turbopack build could not start a worker under the validation environment's restrictions. The delivered `dev` and `build` scripts use Next.js's supported webpack option; both were tested successfully. No app fonts or assets require a remote download at runtime.

The upload folder contains no installed dependencies, generated build cache, environment files, private configuration, database, disk outbox, OAuth integration, paid-model client, local-model client, private evaluation output or internal development notes. Framework-generated files are recreated when the user runs the app and are ignored by Git.
