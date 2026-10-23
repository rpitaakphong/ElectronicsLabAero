# Week 12 pre-lab data contract · implementation 1.0.0 / wire version 4

The JSON schemas describe the portable files; `prelab-adapter.mjs` adds the semantic checks used by the workbook. All examples are synthetic. No file contains measured bench results or independently verified mastery.

| File / object | Purpose | Accepted producer |
| --- | --- | --- |
| `workspace_backup.json` or top Save JSON | Full app recovery | v1.0.0; compatible approved R4 version4 |
| `prelab_evidence.json` | Individual evidence for an integrator | v1 schema `2145427-w12-prelab-evidence-v4`; compatible R4 evidence tag |
| `prelab_report.txt` | Readable handoff | Exported alongside the same evidence/workspace |
| `workflow-link.PROPOSED.synthetic.json` | Illustrative future linking only | Not an existing accepted measurement/postlab interface |

Workspace envelope: `kind` exactly `2145427-W12-workspace-backup`, `version` exactly 4, `workspace` object. Course `2145427`; activity `noise-filtering-prelab-20261026`; stage `prelab`; current screen integer0–9. Current package is `2145427-W12-prelab-1.0.0`; compatible R4 package is `2145427-W12-prelab-review-r4`. R3/version1 and Week11 are unsupported. The app/adapter reject unknown response/check/original keys; known top-level workspace extensions are tolerated, not used.

`fields` contains exactly 26 string keys (maximum10,000 characters each), listed in FIELD_MAPPING.csv and schema. `studentId`/`studentName` are student claims, not authentication. `practiceNoise` and reserved legacy `practiceFilter` are optional formative slots; `practiceFilter` has no current UI. `maWork`/`emaWork` hold the student's different hand calculations. For p1/p2, `first`, `reason`, `assumption`, `uncertainty` inputs are copied into `frozen.p1/p2` when preserved; `p1revision/p2revision` remain separate later responses, with support in `p1help/p2help`. `check1/check2` are copied to `frozen.check`. Reflection/disclosure fields are `aiUsed`, `aiExposure`, `claim`, `verification`, `limitation`, `handoff`.

`frozen.p1/p2` is null or an exact object with string `first`, `reason`, `assumption`, `uncertainty`, `time`. Non-time entries must be nonblank. `frozen.check` is null or exact string `check1`, `check2`, `time`, with nonblank responses. Preserved times are client strings, not proof of ordering/authorship. Workspace `created`/`updated` must be parseable dates; app-generated values use ISO UTC. Restore/save refreshes updated, not the preserved originals.

`checks` has exactly boolean `identityConfirm`, `honestyConfirm`, `independentConfirm`. `finalized` is boolean. Finalized completeness additionally requires nonblank identity, maWork/emaWork, p1/p2 revisions/support, six reflection/disclosure fields; all three frozen records and all confirmations. Draft strings may be empty. Completeness is not correctness or independence.

Evidence schema fields map as follows: workspace fields → `responses`; frozen → `originals`; checks → `confirmations`; created/updated → `created_client/updated_client`; finalized boolean → `status` (`draft`/`finalized`); identity is duplicated at `student.id/name` and must match responses. `assigned_context` preserves the p1/p2/check1/check2 case descriptions; `disclaimer` retains evidence limits. It is an individual record; never treat it as the course-system de-identified aggregate learning-evidence schema.

The adapter validates supported envelope/schema/package, activity/stage, structured fields, timestamps, original records, identity consistency and final completeness. JSON Schema validates structure; use the semantic adapter as well. Neither validator provides a cryptographic signature, assigns a grade, judges text, verifies AI disclosure or proves a physical measurement. Unknown evidence fields can be retained in the original file; the supplied schema intentionally describes the exact generated evidence shape.

Use JSON text ≤500,000 UTF-8 bytes for the supplied adapter. The app's File.size gate is the same byte limit; its field maxlength is character based. Treat untrusted imported text literally. The adapter preserves the source package and returns it unchanged; the app's confirmed R4 restore normalizes package to the implementation ID. `toDashboardView` is a locally tested convenience view, **not** your dashboard's database/API contract. It explicitly leaves measurement and postlab fields null.

No HTTP API, `postMessage` event, automatic synchronization, gradebook submission, measurement upload or postlab callback is implemented. Associate original files through your own authenticated records. A later importer should preserve originals, append actual measured records separately, and link individual postlab claims to evidence rather than overwrite pre-lab predictions.
