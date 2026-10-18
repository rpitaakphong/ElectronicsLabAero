// Format adapter extracted from the supplied student release, not the earlier draft reference.
export const SCHEMA_VERSION = '0.2.0-DRAFT';
export const PACKAGE_VERSION = '2145427-555-prelab-0.2.0-DRAFT-audit-r01';
export const CONTEXT_VERSION = '2145427-555-prelab-coach-v1.0-DRAFT';
export const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_ZIP_BYTES = MAX_JSON_BYTES + 512,
  FINAL_ENTRY = 'prelab_evidence.json';
const enc = new TextEncoder(),
  dec = new TextDecoder('utf-8', { fatal: true });
const cleanText = (value) => (typeof value === 'string' ? value : '');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const deepClone = (value) => JSON.parse(JSON.stringify(value));
const exactScenarios = {
  'PRE-P01': ['PRE-P01-A', 'PRE-P01-B'],
  'PRE-P02': ['PRE-P02-C', 'PRE-P02-D'],
};
const allowedBankIds = new Set(
  ['PHY', 'ASM', 'UNC', 'JDG', 'GEN'].flatMap((cat) =>
    [1, 2, 3, 4].map((n) => 'UC-' + cat + '-0' + n),
  ),
);
export function makeValidSyntheticEvidence() {
  const stamp = '2026-10-14T00:00:00.000Z';
  const response1 = {
    selections: { high_time: 'unsure' },
    periods_seconds: { original: null, modified: null },
    decision: null,
    reasoning: 'I am explicitly unsure.',
  };
  const response2 = {
    selections: { high_time: 'unsure' },
    periods_seconds: { original: null, modified: null },
    decision: 'cannot_decide',
    reasoning: 'I am explicitly unsure.',
  };
  const makeQuestion = (qid, response, item) => ({
    question_id: qid,
    scenario_ids: exactScenarios[qid].slice(),
    source_kind: 'student_pre_lab_prediction',
    configuration_kind: 'hypothetical_ideal_astable',
    initial_snapshot: {
      captured_at_client: stamp,
      response: deepClone(response),
    },
    working_response: deepClone(response),
    revision_events: [
      {
        revision_id: 'fixture-rev-000001',
        recorded_at_client: stamp,
        event: 'freeze_original',
        reason: 'fixture',
        response: deepClone(response),
      },
    ],
    difficulty: ['NOT_SURE'],
    priority_difficulty: 'NOT_SURE',
    coaching: {
      context_version: CONTEXT_VERSION,
      prompt_copied: false,
      ai_use: 'no',
      assistance: 'none',
      disclosure_history: [],
      claims: [],
    },
    understanding_checks: {
      initial: {
        item_id: item,
        attempt_text: 'I remain unsure.',
        confidence: 'unsure',
        route_category: 'GEN',
        route_context: {
          priority_difficulty: 'NOT_SURE',
          selected_difficulties: ['NOT_SURE'],
          diagnostic_choice: 'GEN',
          resolved_category: 'GEN',
        },
        coaching_after: false,
        recorded_at_client: stamp,
      },
      retry: null,
      requested_retry: false,
    },
    optional_learning: [],
    acknowledged_missing: true,
  });
  return {
    schema_id: '2145427-prelab-evidence',
    schema_version: SCHEMA_VERSION,
    course_id: '2145427',
    activity_id: '555-timer-prelab-2026',
    stage: 'prelab',
    package_version: PACKAGE_VERSION,
    coaching_context_version: CONTEXT_VERSION,
    status: 'finalized',
    record_id: 'fixture-record-000001',
    revision_id: 'fixture-revision-000001',
    parent_revision_id: null,
    student: {
      university_student_id: 'TEST0001',
      full_name: 'Synthetic Test Student',
    },
    created_at_client: stamp,
    last_saved_at_client: stamp,
    finalized_at_client: stamp,
    source_scope: 'prelab_teaching_examples',
    questions: {
      'PRE-P01': makeQuestion('PRE-P01', response1, 'UC-GEN-01'),
      'PRE-P02': makeQuestion('PRE-P02', response2, 'UC-GEN-02'),
    },
    used_understanding_item_ids: ['UC-GEN-01', 'UC-GEN-02'],
    learning_progress: {
      visited_screen_ids: [0, 6, 7, 9],
      practice_responses: {},
      coach_context_confirmed: false,
      learning_route: 'solo',
    },
    review: {
      student_identity_confirmed: true,
      missing_acknowledged: true,
      final_review_completed: true,
    },
    evidence_disclaimer:
      'Student pre-lab hypothetical predictions; no physical measurements; local times and identifiers are student-controlled and do not prove submission or independent completion.',
  };
}
