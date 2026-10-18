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
const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:2145427:555:prelab:evidence:0.2.0-DRAFT',
  title:
    '2145427 555 timer individual pre-lab evidence JSON — 0.2.0-DRAFT candidate contract',
  type: 'object',
  $defs: {
    verificationRevision: {
      type: 'object',
      additionalProperties: false,
      required: [
        'recorded_at_client',
        'claim_text',
        'source',
        'context_question_id',
        'verification_method',
        'evidence_kind',
        'evidence_text',
        'judgment',
        'rationale',
        'limitations',
      ],
      properties: {
        recorded_at_client: {
          type: 'string',
          format: 'date-time',
        },
        claim_text: {
          type: 'string',
          minLength: 0,
          maxLength: 20000,
        },
        source: {
          enum: ['prediction', 'optional_ai', 'optional_learning'],
        },
        context_question_id: {
          enum: ['PRE-P01', 'PRE-P02', 'optional_learning'],
        },
        verification_method: {
          enum: [
            'not_selected',
            'calculation',
            'course_principle',
            'authoritative_reference',
            'physical_check_needed_later',
            'unsure',
          ],
        },
        evidence_kind: {
          enum: ['none', 'existing_evidence', 'proposed_later_check'],
        },
        evidence_text: {
          type: 'string',
          minLength: 0,
          maxLength: 20000,
        },
        judgment: {
          enum: ['not_evaluated', 'supported', 'contradicted', 'unresolved'],
        },
        rationale: {
          type: 'string',
          minLength: 0,
          maxLength: 20000,
        },
        limitations: {
          type: 'string',
          minLength: 0,
          maxLength: 20000,
        },
      },
    },
    routeContext: {
      type: 'object',
      additionalProperties: false,
      required: [
        'priority_difficulty',
        'selected_difficulties',
        'diagnostic_choice',
        'resolved_category',
      ],
      properties: {
        priority_difficulty: {
          anyOf: [
            {
              enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE', 'GEN'],
            },
            {
              type: 'null',
            },
          ],
        },
        selected_difficulties: {
          type: 'array',
          uniqueItems: true,
          items: {
            enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE'],
          },
        },
        diagnostic_choice: {
          anyOf: [
            {
              enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'GEN'],
            },
            {
              type: 'null',
            },
          ],
        },
        resolved_category: {
          enum: ['PHY', 'ASM', 'UNC', 'JDG', 'GEN'],
        },
      },
    },
  },
  additionalProperties: false,
  required: [
    'schema_id',
    'schema_version',
    'course_id',
    'activity_id',
    'stage',
    'package_version',
    'coaching_context_version',
    'status',
    'record_id',
    'revision_id',
    'parent_revision_id',
    'student',
    'created_at_client',
    'last_saved_at_client',
    'finalized_at_client',
    'source_scope',
    'questions',
    'used_understanding_item_ids',
    'learning_progress',
    'review',
    'evidence_disclaimer',
  ],
  properties: {
    schema_id: {
      const: '2145427-prelab-evidence',
    },
    schema_version: {
      const: '0.2.0-DRAFT',
    },
    course_id: {
      const: '2145427',
    },
    activity_id: {
      const: '555-timer-prelab-2026',
    },
    stage: {
      const: 'prelab',
    },
    package_version: {
      type: 'string',
      minLength: 4,
    },
    coaching_context_version: {
      type: 'string',
      minLength: 4,
    },
    status: {
      enum: ['draft', 'finalized'],
    },
    record_id: {
      type: 'string',
      minLength: 6,
    },
    revision_id: {
      type: 'string',
      minLength: 6,
    },
    parent_revision_id: {
      type: ['string', 'null'],
    },
    student: {
      type: 'object',
      additionalProperties: false,
      required: ['university_student_id', 'full_name'],
      properties: {
        university_student_id: {
          type: 'string',
          minLength: 1,
          maxLength: 40,
        },
        full_name: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
        },
      },
    },
    created_at_client: {
      anyOf: [
        {
          type: 'string',
          format: 'date-time',
        },
        {
          type: 'null',
        },
      ],
    },
    last_saved_at_client: {
      anyOf: [
        {
          type: 'string',
          format: 'date-time',
        },
        {
          type: 'null',
        },
      ],
    },
    finalized_at_client: {
      anyOf: [
        {
          type: 'string',
          format: 'date-time',
        },
        {
          type: 'null',
        },
      ],
    },
    source_scope: {
      const: 'prelab_teaching_examples',
    },
    questions: {
      type: 'object',
      additionalProperties: false,
      required: ['PRE-P01', 'PRE-P02'],
      properties: {
        'PRE-P01': {
          type: 'object',
          additionalProperties: false,
          required: [
            'question_id',
            'scenario_ids',
            'source_kind',
            'configuration_kind',
            'initial_snapshot',
            'working_response',
            'revision_events',
            'difficulty',
            'priority_difficulty',
            'coaching',
            'understanding_checks',
            'optional_learning',
            'acknowledged_missing',
          ],
          properties: {
            question_id: {
              const: 'PRE-P01',
            },
            scenario_ids: {
              type: 'array',
              minItems: 2,
              maxItems: 2,
              items: {
                type: 'string',
              },
            },
            source_kind: {
              const: 'student_pre_lab_prediction',
            },
            configuration_kind: {
              const: 'hypothetical_ideal_astable',
            },
            initial_snapshot: {
              anyOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['captured_at_client', 'response'],
                  properties: {
                    captured_at_client: {
                      anyOf: [
                        {
                          type: 'string',
                          format: 'date-time',
                        },
                        {
                          type: 'null',
                        },
                      ],
                    },
                    response: {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'selections',
                        'periods_seconds',
                        'decision',
                        'reasoning',
                      ],
                      properties: {
                        selections: {
                          type: 'object',
                          propertyNames: {
                            enum: [
                              'high_time',
                              'low_time',
                              'period',
                              'frequency',
                              'high_duty',
                            ],
                          },
                          additionalProperties: {
                            type: 'string',
                            enum: [
                              'increase',
                              'decrease',
                              'unchanged',
                              'unsure',
                            ],
                          },
                        },
                        periods_seconds: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            original: {
                              anyOf: [
                                {
                                  type: 'string',
                                  pattern: '^[0-9]*(\\.[0-9]*)?$',
                                },
                                {
                                  type: 'null',
                                },
                              ],
                            },
                            modified: {
                              anyOf: [
                                {
                                  type: 'string',
                                  pattern: '^[0-9]*(\\.[0-9]*)?$',
                                },
                                {
                                  type: 'null',
                                },
                              ],
                            },
                          },
                        },
                        decision: {
                          type: ['string', 'null'],
                          enum: [
                            'reasonable',
                            'not_reasonable',
                            'cannot_decide',
                            null,
                          ],
                        },
                        reasoning: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                      },
                    },
                  },
                },
                {
                  type: 'null',
                },
              ],
            },
            working_response: {
              type: 'object',
              additionalProperties: false,
              required: [
                'selections',
                'periods_seconds',
                'decision',
                'reasoning',
              ],
              properties: {
                selections: {
                  type: 'object',
                  propertyNames: {
                    enum: [
                      'high_time',
                      'low_time',
                      'period',
                      'frequency',
                      'high_duty',
                    ],
                  },
                  additionalProperties: {
                    type: 'string',
                    enum: ['increase', 'decrease', 'unchanged', 'unsure'],
                  },
                },
                periods_seconds: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    original: {
                      anyOf: [
                        {
                          type: 'string',
                          pattern: '^[0-9]*(\\.[0-9]*)?$',
                        },
                        {
                          type: 'null',
                        },
                      ],
                    },
                    modified: {
                      anyOf: [
                        {
                          type: 'string',
                          pattern: '^[0-9]*(\\.[0-9]*)?$',
                        },
                        {
                          type: 'null',
                        },
                      ],
                    },
                  },
                },
                decision: {
                  type: ['string', 'null'],
                  enum: ['reasonable', 'not_reasonable', 'cannot_decide', null],
                },
                reasoning: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20000,
                },
              },
            },
            revision_events: {
              type: 'array',
              maxItems: 1000,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'revision_id',
                  'recorded_at_client',
                  'event',
                  'reason',
                  'response',
                ],
                properties: {
                  revision_id: {
                    type: 'string',
                    minLength: 6,
                  },
                  recorded_at_client: {
                    anyOf: [
                      {
                        type: 'string',
                        format: 'date-time',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },
                  event: {
                    enum: [
                      'freeze_original',
                      'student_revision',
                      'restore_child_revision',
                      'finalize',
                      'correct_ai_disclosure',
                    ],
                  },
                  reason: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  response: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'selections',
                      'periods_seconds',
                      'decision',
                      'reasoning',
                    ],
                    properties: {
                      selections: {
                        type: 'object',
                        propertyNames: {
                          enum: [
                            'high_time',
                            'low_time',
                            'period',
                            'frequency',
                            'high_duty',
                          ],
                        },
                        additionalProperties: {
                          type: 'string',
                          enum: ['increase', 'decrease', 'unchanged', 'unsure'],
                        },
                      },
                      periods_seconds: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          original: {
                            anyOf: [
                              {
                                type: 'string',
                                pattern: '^[0-9]*(\\.[0-9]*)?$',
                              },
                              {
                                type: 'null',
                              },
                            ],
                          },
                          modified: {
                            anyOf: [
                              {
                                type: 'string',
                                pattern: '^[0-9]*(\\.[0-9]*)?$',
                              },
                              {
                                type: 'null',
                              },
                            ],
                          },
                        },
                      },
                      decision: {
                        type: ['string', 'null'],
                        enum: [
                          'reasonable',
                          'not_reasonable',
                          'cannot_decide',
                          null,
                        ],
                      },
                      reasoning: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                    },
                  },
                },
              },
            },
            difficulty: {
              type: 'array',
              uniqueItems: true,
              items: {
                enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE'],
              },
            },
            priority_difficulty: {
              anyOf: [
                {
                  enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE', 'GEN'],
                },
                {
                  type: 'null',
                },
              ],
            },
            coaching: {
              type: 'object',
              additionalProperties: false,
              required: [
                'context_version',
                'prompt_copied',
                'ai_use',
                'assistance',
                'disclosure_history',
                'claims',
              ],
              properties: {
                context_version: {
                  type: 'string',
                },
                prompt_copied: {
                  type: 'boolean',
                },
                ai_use: {
                  enum: ['yes', 'no', 'not_declared'],
                },
                assistance: {
                  enum: [
                    'none',
                    'concept',
                    'method',
                    'partial_answer',
                    'complete_answer',
                    'unsure_exposure',
                  ],
                },
                disclosure_history: {
                  type: 'array',
                  maxItems: 100,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['recorded_at_client', 'before', 'after'],
                    properties: {
                      recorded_at_client: {
                        type: 'string',
                        format: 'date-time',
                      },
                      before: {
                        type: 'string',
                      },
                      after: {
                        type: 'string',
                      },
                    },
                  },
                },
                claims: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'claim_text',
                      'context_question_id',
                      'verification_method',
                      'evidence_kind',
                      'evidence_text',
                      'judgment',
                      'rationale',
                      'limitations',
                      'verification_history',
                      'selected_for_final_verification',
                    ],
                    properties: {
                      claim_text: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      context_question_id: {
                        enum: ['PRE-P01', 'PRE-P02', 'optional_learning'],
                      },
                      verification_method: {
                        enum: [
                          'not_selected',
                          'calculation',
                          'course_principle',
                          'authoritative_reference',
                          'physical_check_needed_later',
                          'unsure',
                        ],
                      },
                      evidence_kind: {
                        enum: [
                          'none',
                          'existing_evidence',
                          'proposed_later_check',
                        ],
                      },
                      evidence_text: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      judgment: {
                        enum: [
                          'not_evaluated',
                          'supported',
                          'contradicted',
                          'unresolved',
                        ],
                      },
                      rationale: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      limitations: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      verification_history: {
                        type: 'array',
                        maxItems: 100,
                        items: {
                          $ref: '#/$defs/verificationRevision',
                        },
                      },
                      selected_for_final_verification: {
                        type: 'boolean',
                      },
                    },
                  },
                },
              },
            },
            understanding_checks: {
              type: 'object',
              additionalProperties: false,
              required: ['initial', 'retry', 'requested_retry'],
              properties: {
                initial: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'item_id',
                        'attempt_text',
                        'confidence',
                        'route_category',
                        'route_context',
                        'coaching_after',
                        'recorded_at_client',
                      ],
                      properties: {
                        item_id: {
                          type: 'string',
                          pattern: '^UC-(PHY|ASM|UNC|JDG|GEN)-0[1-4]$',
                        },
                        attempt_text: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                        confidence: {
                          type: 'string',
                          enum: ['low', 'medium', 'high', 'unsure'],
                        },
                        route_category: {
                          anyOf: [
                            {
                              enum: ['PHY', 'ASM', 'UNC', 'JDG', 'GEN'],
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        route_context: {
                          anyOf: [
                            {
                              $ref: '#/$defs/routeContext',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        coaching_after: {
                          type: 'boolean',
                        },
                        recorded_at_client: {
                          anyOf: [
                            {
                              type: 'string',
                              format: 'date-time',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                      },
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
                retry: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'item_id',
                        'attempt_text',
                        'confidence',
                        'route_category',
                        'route_context',
                        'coaching_after',
                        'recorded_at_client',
                      ],
                      properties: {
                        item_id: {
                          type: 'string',
                          pattern: '^UC-(PHY|ASM|UNC|JDG|GEN)-0[1-4]$',
                        },
                        attempt_text: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                        confidence: {
                          type: 'string',
                          enum: ['low', 'medium', 'high', 'unsure'],
                        },
                        route_category: {
                          anyOf: [
                            {
                              enum: ['PHY', 'ASM', 'UNC', 'JDG', 'GEN'],
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        route_context: {
                          anyOf: [
                            {
                              $ref: '#/$defs/routeContext',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        coaching_after: {
                          type: 'boolean',
                        },
                        recorded_at_client: {
                          anyOf: [
                            {
                              type: 'string',
                              format: 'date-time',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                      },
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
                requested_retry: {
                  type: 'boolean',
                },
              },
            },
            optional_learning: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'category',
                  'initial_difficulty',
                  'assistance',
                  'later_understanding',
                  'important_claim',
                  'formative_responses',
                  'status',
                ],
                properties: {
                  category: {
                    enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE'],
                  },
                  initial_difficulty: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  assistance: {
                    enum: [
                      'none',
                      'concept',
                      'method',
                      'partial_answer',
                      'complete_answer',
                      'unsure_exposure',
                    ],
                  },
                  later_understanding: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  important_claim: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  formative_responses: {
                    type: 'array',
                    maxItems: 20,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'recorded_at_client',
                        'response',
                        'confidence',
                      ],
                      properties: {
                        recorded_at_client: {
                          type: 'string',
                          format: 'date-time',
                        },
                        response: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                        confidence: {
                          enum: ['low', 'medium', 'high', 'unsure'],
                        },
                      },
                    },
                  },
                  status: {
                    enum: ['resolved', 'partially_resolved', 'unresolved'],
                  },
                },
              },
            },
            acknowledged_missing: {
              type: 'boolean',
            },
          },
        },
        'PRE-P02': {
          type: 'object',
          additionalProperties: false,
          required: [
            'question_id',
            'scenario_ids',
            'source_kind',
            'configuration_kind',
            'initial_snapshot',
            'working_response',
            'revision_events',
            'difficulty',
            'priority_difficulty',
            'coaching',
            'understanding_checks',
            'optional_learning',
            'acknowledged_missing',
          ],
          properties: {
            question_id: {
              enum: ['PRE-P01', 'PRE-P02'],
            },
            scenario_ids: {
              type: 'array',
              minItems: 2,
              maxItems: 2,
              items: {
                type: 'string',
              },
            },
            source_kind: {
              const: 'student_pre_lab_prediction',
            },
            configuration_kind: {
              const: 'hypothetical_ideal_astable',
            },
            initial_snapshot: {
              anyOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['captured_at_client', 'response'],
                  properties: {
                    captured_at_client: {
                      anyOf: [
                        {
                          type: 'string',
                          format: 'date-time',
                        },
                        {
                          type: 'null',
                        },
                      ],
                    },
                    response: {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'selections',
                        'periods_seconds',
                        'decision',
                        'reasoning',
                      ],
                      properties: {
                        selections: {
                          type: 'object',
                          propertyNames: {
                            enum: [
                              'high_time',
                              'low_time',
                              'period',
                              'frequency',
                              'high_duty',
                            ],
                          },
                          additionalProperties: {
                            type: 'string',
                            enum: [
                              'increase',
                              'decrease',
                              'unchanged',
                              'unsure',
                            ],
                          },
                        },
                        periods_seconds: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            original: {
                              anyOf: [
                                {
                                  type: 'string',
                                  pattern: '^[0-9]*(\\.[0-9]*)?$',
                                },
                                {
                                  type: 'null',
                                },
                              ],
                            },
                            modified: {
                              anyOf: [
                                {
                                  type: 'string',
                                  pattern: '^[0-9]*(\\.[0-9]*)?$',
                                },
                                {
                                  type: 'null',
                                },
                              ],
                            },
                          },
                        },
                        decision: {
                          type: ['string', 'null'],
                          enum: [
                            'reasonable',
                            'not_reasonable',
                            'cannot_decide',
                            null,
                          ],
                        },
                        reasoning: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                      },
                    },
                  },
                },
                {
                  type: 'null',
                },
              ],
            },
            working_response: {
              type: 'object',
              additionalProperties: false,
              required: [
                'selections',
                'periods_seconds',
                'decision',
                'reasoning',
              ],
              properties: {
                selections: {
                  type: 'object',
                  propertyNames: {
                    enum: [
                      'high_time',
                      'low_time',
                      'period',
                      'frequency',
                      'high_duty',
                    ],
                  },
                  additionalProperties: {
                    type: 'string',
                    enum: ['increase', 'decrease', 'unchanged', 'unsure'],
                  },
                },
                periods_seconds: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    original: {
                      anyOf: [
                        {
                          type: 'string',
                          pattern: '^[0-9]*(\\.[0-9]*)?$',
                        },
                        {
                          type: 'null',
                        },
                      ],
                    },
                    modified: {
                      anyOf: [
                        {
                          type: 'string',
                          pattern: '^[0-9]*(\\.[0-9]*)?$',
                        },
                        {
                          type: 'null',
                        },
                      ],
                    },
                  },
                },
                decision: {
                  type: ['string', 'null'],
                  enum: ['reasonable', 'not_reasonable', 'cannot_decide', null],
                },
                reasoning: {
                  type: 'string',
                  minLength: 0,
                  maxLength: 20000,
                },
              },
            },
            revision_events: {
              type: 'array',
              maxItems: 1000,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'revision_id',
                  'recorded_at_client',
                  'event',
                  'reason',
                  'response',
                ],
                properties: {
                  revision_id: {
                    type: 'string',
                    minLength: 6,
                  },
                  recorded_at_client: {
                    anyOf: [
                      {
                        type: 'string',
                        format: 'date-time',
                      },
                      {
                        type: 'null',
                      },
                    ],
                  },
                  event: {
                    enum: [
                      'freeze_original',
                      'student_revision',
                      'restore_child_revision',
                      'finalize',
                      'correct_ai_disclosure',
                    ],
                  },
                  reason: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  response: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'selections',
                      'periods_seconds',
                      'decision',
                      'reasoning',
                    ],
                    properties: {
                      selections: {
                        type: 'object',
                        propertyNames: {
                          enum: [
                            'high_time',
                            'low_time',
                            'period',
                            'frequency',
                            'high_duty',
                          ],
                        },
                        additionalProperties: {
                          type: 'string',
                          enum: ['increase', 'decrease', 'unchanged', 'unsure'],
                        },
                      },
                      periods_seconds: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          original: {
                            anyOf: [
                              {
                                type: 'string',
                                pattern: '^[0-9]*(\\.[0-9]*)?$',
                              },
                              {
                                type: 'null',
                              },
                            ],
                          },
                          modified: {
                            anyOf: [
                              {
                                type: 'string',
                                pattern: '^[0-9]*(\\.[0-9]*)?$',
                              },
                              {
                                type: 'null',
                              },
                            ],
                          },
                        },
                      },
                      decision: {
                        type: ['string', 'null'],
                        enum: [
                          'reasonable',
                          'not_reasonable',
                          'cannot_decide',
                          null,
                        ],
                      },
                      reasoning: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                    },
                  },
                },
              },
            },
            difficulty: {
              type: 'array',
              uniqueItems: true,
              items: {
                enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE'],
              },
            },
            priority_difficulty: {
              anyOf: [
                {
                  enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE', 'GEN'],
                },
                {
                  type: 'null',
                },
              ],
            },
            coaching: {
              type: 'object',
              additionalProperties: false,
              required: [
                'context_version',
                'prompt_copied',
                'ai_use',
                'assistance',
                'disclosure_history',
                'claims',
              ],
              properties: {
                context_version: {
                  type: 'string',
                },
                prompt_copied: {
                  type: 'boolean',
                },
                ai_use: {
                  enum: ['yes', 'no', 'not_declared'],
                },
                assistance: {
                  enum: [
                    'none',
                    'concept',
                    'method',
                    'partial_answer',
                    'complete_answer',
                    'unsure_exposure',
                  ],
                },
                disclosure_history: {
                  type: 'array',
                  maxItems: 100,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['recorded_at_client', 'before', 'after'],
                    properties: {
                      recorded_at_client: {
                        type: 'string',
                        format: 'date-time',
                      },
                      before: {
                        type: 'string',
                      },
                      after: {
                        type: 'string',
                      },
                    },
                  },
                },
                claims: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'claim_text',
                      'context_question_id',
                      'verification_method',
                      'evidence_kind',
                      'evidence_text',
                      'judgment',
                      'rationale',
                      'limitations',
                      'verification_history',
                      'selected_for_final_verification',
                    ],
                    properties: {
                      claim_text: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      context_question_id: {
                        enum: ['PRE-P01', 'PRE-P02', 'optional_learning'],
                      },
                      verification_method: {
                        enum: [
                          'not_selected',
                          'calculation',
                          'course_principle',
                          'authoritative_reference',
                          'physical_check_needed_later',
                          'unsure',
                        ],
                      },
                      evidence_kind: {
                        enum: [
                          'none',
                          'existing_evidence',
                          'proposed_later_check',
                        ],
                      },
                      evidence_text: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      judgment: {
                        enum: [
                          'not_evaluated',
                          'supported',
                          'contradicted',
                          'unresolved',
                        ],
                      },
                      rationale: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      limitations: {
                        type: 'string',
                        minLength: 0,
                        maxLength: 20000,
                      },
                      verification_history: {
                        type: 'array',
                        maxItems: 100,
                        items: {
                          $ref: '#/$defs/verificationRevision',
                        },
                      },
                      selected_for_final_verification: {
                        type: 'boolean',
                      },
                    },
                  },
                },
              },
            },
            understanding_checks: {
              type: 'object',
              additionalProperties: false,
              required: ['initial', 'retry', 'requested_retry'],
              properties: {
                initial: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'item_id',
                        'attempt_text',
                        'confidence',
                        'route_category',
                        'route_context',
                        'coaching_after',
                        'recorded_at_client',
                      ],
                      properties: {
                        item_id: {
                          type: 'string',
                          pattern: '^UC-(PHY|ASM|UNC|JDG|GEN)-0[1-4]$',
                        },
                        attempt_text: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                        confidence: {
                          type: 'string',
                          enum: ['low', 'medium', 'high', 'unsure'],
                        },
                        route_category: {
                          anyOf: [
                            {
                              enum: ['PHY', 'ASM', 'UNC', 'JDG', 'GEN'],
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        route_context: {
                          anyOf: [
                            {
                              $ref: '#/$defs/routeContext',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        coaching_after: {
                          type: 'boolean',
                        },
                        recorded_at_client: {
                          anyOf: [
                            {
                              type: 'string',
                              format: 'date-time',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                      },
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
                retry: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'item_id',
                        'attempt_text',
                        'confidence',
                        'route_category',
                        'route_context',
                        'coaching_after',
                        'recorded_at_client',
                      ],
                      properties: {
                        item_id: {
                          type: 'string',
                          pattern: '^UC-(PHY|ASM|UNC|JDG|GEN)-0[1-4]$',
                        },
                        attempt_text: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                        confidence: {
                          type: 'string',
                          enum: ['low', 'medium', 'high', 'unsure'],
                        },
                        route_category: {
                          anyOf: [
                            {
                              enum: ['PHY', 'ASM', 'UNC', 'JDG', 'GEN'],
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        route_context: {
                          anyOf: [
                            {
                              $ref: '#/$defs/routeContext',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                        coaching_after: {
                          type: 'boolean',
                        },
                        recorded_at_client: {
                          anyOf: [
                            {
                              type: 'string',
                              format: 'date-time',
                            },
                            {
                              type: 'null',
                            },
                          ],
                        },
                      },
                    },
                    {
                      type: 'null',
                    },
                  ],
                },
                requested_retry: {
                  type: 'boolean',
                },
              },
            },
            optional_learning: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'category',
                  'initial_difficulty',
                  'assistance',
                  'later_understanding',
                  'important_claim',
                  'formative_responses',
                  'status',
                ],
                properties: {
                  category: {
                    enum: ['PHY', 'ASM', 'UNC', 'MAT', 'JDG', 'NOT_SURE'],
                  },
                  initial_difficulty: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  assistance: {
                    enum: [
                      'none',
                      'concept',
                      'method',
                      'partial_answer',
                      'complete_answer',
                      'unsure_exposure',
                    ],
                  },
                  later_understanding: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  important_claim: {
                    type: 'string',
                    minLength: 0,
                    maxLength: 20000,
                  },
                  formative_responses: {
                    type: 'array',
                    maxItems: 20,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: [
                        'recorded_at_client',
                        'response',
                        'confidence',
                      ],
                      properties: {
                        recorded_at_client: {
                          type: 'string',
                          format: 'date-time',
                        },
                        response: {
                          type: 'string',
                          minLength: 0,
                          maxLength: 20000,
                        },
                        confidence: {
                          enum: ['low', 'medium', 'high', 'unsure'],
                        },
                      },
                    },
                  },
                  status: {
                    enum: ['resolved', 'partially_resolved', 'unresolved'],
                  },
                },
              },
            },
            acknowledged_missing: {
              type: 'boolean',
            },
          },
        },
      },
    },
    used_understanding_item_ids: {
      type: 'array',
      uniqueItems: true,
      items: {
        type: 'string',
        pattern: '^UC-(PHY|ASM|UNC|JDG|GEN)-0[1-4]$',
      },
    },
    learning_progress: {
      type: 'object',
      additionalProperties: false,
      required: [
        'visited_screen_ids',
        'practice_responses',
        'coach_context_confirmed',
        'learning_route',
      ],
      properties: {
        visited_screen_ids: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'integer',
            minimum: 0,
            maximum: 9,
          },
        },
        practice_responses: {
          type: 'object',
          additionalProperties: {
            type: ['string', 'boolean', 'number', 'null'],
          },
        },
        coach_context_confirmed: {
          type: 'boolean',
        },
        learning_route: {
          enum: ['ai', 'solo', 'undecided'],
        },
      },
    },
    review: {
      type: 'object',
      additionalProperties: false,
      required: [
        'student_identity_confirmed',
        'missing_acknowledged',
        'final_review_completed',
      ],
      properties: {
        student_identity_confirmed: {
          type: 'boolean',
        },
        missing_acknowledged: {
          type: 'boolean',
        },
        final_review_completed: {
          type: 'boolean',
        },
      },
    },
    evidence_disclaimer: {
      const:
        'Student pre-lab hypothetical predictions; no physical measurements; local times and identifiers are student-controlled and do not prove submission or independent completion.',
    },
  },
};
function responseHasStudentEntry(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response))
    return false;
  const selections = response.selections;
  const periods = response.periods_seconds;
  return !!(
    (selections &&
      typeof selections === 'object' &&
      !Array.isArray(selections) &&
      Object.keys(selections).length) ||
    (periods &&
      typeof periods === 'object' &&
      !Array.isArray(periods) &&
      (cleanText(periods.original).trim() ||
        cleanText(periods.modified).trim())) ||
    cleanText(response.decision).trim() ||
    cleanText(response.reasoning).trim()
  );
}
function schemaType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value === 'number' ? 'number' : typeof value;
}

function resolveRef(ref) {
  if (!ref.startsWith('#/'))
    throw new Error('Only local schema references are supported.');
  return ref
    .slice(2)
    .split('/')
    .reduce(
      (node, part) => node[part.replace(/~1/g, '/').replace(/~0/g, '~')],
      SCHEMA,
    );
}

function schemaCheck(value, schema = SCHEMA, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object')
    return [`${path}: invalid bundled schema node.`];
  if (schema.$ref) return schemaCheck(value, resolveRef(schema.$ref), path);
  if (schema.anyOf) {
    const branches = schema.anyOf.map((branch) =>
      schemaCheck(value, branch, path),
    );
    if (!branches.some((branch) => branch.length === 0))
      errors.push(`${path}: does not match any allowed schema shape.`);
    return errors;
  }
  if (schema.const !== undefined && !same(value, schema.const))
    errors.push(`${path}: must equal the required constant.`);
  if (schema.enum && !schema.enum.some((item) => same(item, value)))
    errors.push(`${path}: value is not in the allowed enumeration.`);
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = schemaType(value);
    if (
      !allowed.includes(actual) &&
      !(actual === 'integer' && allowed.includes('number'))
    )
      return errors.concat(
        `${path}: expected ${allowed.join(' or ')}, received ${actual}.`,
      );
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength)
      errors.push(`${path}: string is shorter than ${schema.minLength}.`);
    if (schema.maxLength != null && value.length > schema.maxLength)
      errors.push(`${path}: string is longer than ${schema.maxLength}.`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push(`${path}: string does not match the required pattern.`);
    if (
      schema.format === 'date-time' &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
    )
      errors.push(`${path}: must be an ISO UTC date-time.`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum)
      errors.push(`${path}: number is below ${schema.minimum}.`);
    if (schema.maximum != null && value > schema.maximum)
      errors.push(`${path}: number is above ${schema.maximum}.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems)
      errors.push(`${path}: array needs at least ${schema.minItems} items.`);
    if (schema.maxItems != null && value.length > schema.maxItems)
      errors.push(`${path}: array exceeds ${schema.maxItems} items.`);
    if (
      schema.uniqueItems &&
      new Set(value.map((item) => JSON.stringify(item))).size !== value.length
    )
      errors.push(`${path}: array items must be unique.`);
    if (schema.items)
      value.forEach((item, index) =>
        errors.push(...schemaCheck(item, schema.items, `${path}[${index}]`)),
      );
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const required of schema.required || [])
      if (!(required in value))
        errors.push(`${path}.${required}: required property is missing.`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames)
        errors.push(
          ...schemaCheck(key, schema.propertyNames, `${path}{property:${key}}`),
        );
      if (Object.hasOwn(props, key))
        errors.push(...schemaCheck(item, props[key], `${path}.${key}`));
      else if (schema.additionalProperties === false)
        errors.push(`${path}.${key}: additional property is not allowed.`);
      else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === 'object'
      )
        errors.push(
          ...schemaCheck(item, schema.additionalProperties, `${path}.${key}`),
        );
    }
  }
  return errors;
}

function semanticCheck(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['Evidence must be an object.'];
  if (e.schema_version !== SCHEMA_VERSION)
    errors.push('Unsupported pre-lab schema version.');
  if (e.coaching_context_version !== CONTEXT_VERSION)
    errors.push('Unsupported pre-lab coaching context version.');
  if (
    ![PACKAGE_VERSION, '2145427-555-prelab-0.2.0-DRAFT'].includes(
      e.package_version,
    )
  )
    errors.push('Unsupported pre-lab package version.');
  const questions = e.questions || {};
  for (const qid of ['PRE-P01', 'PRE-P02']) {
    const q = questions[qid];
    if (!q) continue;
    if (typeof q !== 'object' || Array.isArray(q)) {
      errors.push(`questions.${qid} must be an object.`);
      continue;
    }
    if (q.question_id !== qid)
      errors.push(`questions.${qid}.question_id must be ${qid}.`);
    if (!same(q.scenario_ids, exactScenarios[qid]))
      errors.push(
        `questions.${qid}.scenario_ids do not match the frozen hypothetical scenarios.`,
      );
    const revisions = Array.isArray(q.revision_events) ? q.revision_events : [];
    if (q.initial_snapshot) {
      const freeze = revisions.find(
        (event) => event && event.event === 'freeze_original',
      );
      if (!freeze || !same(freeze.response, q.initial_snapshot.response))
        errors.push(
          `questions.${qid}.initial_snapshot must equal its freeze_original event.`,
        );
      if (
        freeze &&
        freeze.recorded_at_client !== q.initial_snapshot.captured_at_client
      )
        errors.push(
          `questions.${qid}.initial_snapshot capture time must equal its freeze_original time.`,
        );
      if (!responseHasStudentEntry(q.initial_snapshot.response))
        errors.push(
          `questions.${qid}.initial_snapshot must contain a selected direction, period attempt, decision, reasoning, or explicit uncertainty.`,
        );
    } else if (
      revisions.some((event) => event && event.event === 'freeze_original')
    )
      errors.push(
        `questions.${qid} has a freeze event without an initial snapshot.`,
      );
    const revisionIds = revisions
      .map((event) => event && event.revision_id)
      .filter((id) => typeof id === 'string');
    if (new Set(revisionIds).size !== revisionIds.length)
      errors.push(`questions.${qid} contains duplicate revision IDs.`);
    const attempts = [
      q.understanding_checks && q.understanding_checks.initial,
      q.understanding_checks && q.understanding_checks.retry,
    ].filter(Boolean);
    if (attempts.length > 2)
      errors.push(`questions.${qid} has more than one retry.`);
    if (attempts.length === 2) {
      if (attempts[0].item_id === attempts[1].item_id)
        errors.push(`questions.${qid} repeats its initial understanding item.`);
      if (
        cleanText(attempts[0].item_id).slice(0, 6) !==
        cleanText(attempts[1].item_id).slice(0, 6)
      )
        errors.push(
          `questions.${qid} retry must remain in the initial category.`,
        );
    }
    for (const a of attempts) {
      if (!a || typeof a !== 'object' || !allowedBankIds.has(a.item_id))
        errors.push(`questions.${qid} contains an unknown understanding item.`);
      else {
        const itemCategory = a.item_id.split('-')[1];
        const legacyUnknownRoute =
          a.route_category === null && a.route_context === null;
        if (
          !legacyUnknownRoute &&
          (a.route_category !== itemCategory ||
            !a.route_context ||
            a.route_context.resolved_category !== itemCategory)
        )
          errors.push(
            `questions.${qid} understanding item does not match its recorded route category.`,
          );
        if (
          !legacyUnknownRoute &&
          a.route_context &&
          typeof a.route_context === 'object'
        ) {
          const priority = a.route_context.priority_difficulty;
          const diagnostic = a.route_context.diagnostic_choice;
          const expected =
            priority === 'NOT_SURE'
              ? ['PHY', 'ASM', 'UNC', 'JDG'].includes(diagnostic)
                ? diagnostic
                : 'GEN'
              : ['PHY', 'ASM', 'UNC', 'JDG'].includes(priority)
                ? priority
                : 'GEN';
          if (expected !== itemCategory)
            errors.push(
              `questions.${qid} understanding item is inconsistent with its recorded assignment route.`,
            );
          if (
            priority &&
            priority !== 'GEN' &&
            !(a.route_context.selected_difficulties || []).includes(priority)
          )
            errors.push(
              `questions.${qid} recorded priority was not among the selected difficulties at assignment.`,
            );
        }
      }
    }
    const checks = q.understanding_checks || {};
    if (checks.retry && checks.requested_retry !== true)
      errors.push(
        `questions.${qid} retry evidence requires requested_retry true.`,
      );
    if (
      q.coaching &&
      q.coaching.ai_use === 'no' &&
      q.coaching.assistance !== 'none'
    )
      errors.push(
        `questions.${qid} cannot record AI assistance when ai_use is no.`,
      );
    const claims =
      q.coaching && Array.isArray(q.coaching.claims) ? q.coaching.claims : [];
    const selectedClaims = claims.filter(
      (claim) => claim && claim.selected_for_final_verification === true,
    );
    for (const claim of selectedClaims) {
      if (!cleanText(claim.claim_text).trim())
        errors.push(`questions.${qid} selected claim text is empty.`);
      if (claim.verification_method === 'not_selected')
        errors.push(
          `questions.${qid} selected claim needs a verification method or explicit unsure choice.`,
        );
      if (claim.evidence_kind === 'none')
        errors.push(
          `questions.${qid} selected claim must distinguish evidence from a proposed later check.`,
        );
      if (!cleanText(claim.evidence_text).trim())
        errors.push(
          `questions.${qid} selected claim needs evidence or a proposed check.`,
        );
      if (!cleanText(claim.rationale).trim())
        errors.push(
          `questions.${qid} selected claim needs a judgment rationale.`,
        );
      if (!cleanText(claim.limitations).trim())
        errors.push(
          `questions.${qid} selected claim needs a limitation statement.`,
        );
    }
  }
  const flattened = [];
  for (const qid of ['PRE-P01', 'PRE-P02']) {
    const checks = questions[qid] && questions[qid].understanding_checks;
    if (checks)
      for (const a of [checks.initial, checks.retry])
        if (a && typeof a.item_id === 'string') flattened.push(a.item_id);
  }
  if (new Set(flattened).size !== flattened.length)
    errors.push('Understanding-check item IDs repeat across the record.');
  if (!same(flattened, e.used_understanding_item_ids || []))
    errors.push(
      'used_understanding_item_ids must exactly match the ordered attempts.',
    );
  const selectedCount = ['PRE-P01', 'PRE-P02'].reduce((sum, qid) => {
    const claims =
      questions[qid] &&
      questions[qid].coaching &&
      Array.isArray(questions[qid].coaching.claims)
        ? questions[qid].coaching.claims
        : [];
    return (
      sum +
      claims.filter((c) => c && c.selected_for_final_verification === true)
        .length
    );
  }, 0);
  if (selectedCount > 1)
    errors.push(
      'Only one consequential claim may be selected for final verification.',
    );
  if (e.parent_revision_id && e.parent_revision_id === e.revision_id)
    errors.push('A child revision cannot name itself as its parent.');
  if (e.status === 'finalized') {
    if (!e.finalized_at_client)
      errors.push('Finalized evidence needs finalized_at_client.');
    if (!e.student || !e.student.university_student_id || !e.student.full_name)
      errors.push('Finalized evidence needs student ID and name.');
    if (
      !e.review ||
      !e.review.student_identity_confirmed ||
      !e.review.missing_acknowledged ||
      !e.review.final_review_completed
    )
      errors.push('Finalized evidence needs all review confirmations.');
  } else if (e.finalized_at_client !== null)
    errors.push('Draft evidence cannot have a finalized timestamp.');
  return errors;
}

function validateEvidence(e) {
  const structural = schemaCheck(e);
  try {
    return structural.concat(semanticCheck(e));
  } catch (error) {
    return structural.concat(
      `Semantic validation could not inspect malformed evidence: ${String((error && error.message) || error)}.`,
    );
  }
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function zipOneStored(name, text) {
  const nameBytes = enc.encode(name);
  const data = enc.encode(text);
  if (data.length > MAX_JSON_BYTES)
    throw new Error('Evidence JSON exceeds the calibrated supported size.');
  const localLength = 30 + nameBytes.length + data.length;
  const centralLength = 46 + nameBytes.length;
  const out = new Uint8Array(localLength + centralLength + 22);
  const view = new DataView(out.buffer);
  let o = 0;
  const u16 = (value) => {
    view.setUint16(o, value, true);
    o += 2;
  };
  const u32 = (value) => {
    view.setUint32(o, value >>> 0, true);
    o += 4;
  };
  const crc = crc32(data);
  u32(0x04034b50);
  u16(20);
  u16(0x0800);
  u16(0);
  u16(0);
  u16(0);
  u32(crc);
  u32(data.length);
  u32(data.length);
  u16(nameBytes.length);
  u16(0);
  out.set(nameBytes, o);
  o += nameBytes.length;
  out.set(data, o);
  o += data.length;
  const centralOffset = o;
  u32(0x02014b50);
  u16(20);
  u16(20);
  u16(0x0800);
  u16(0);
  u16(0);
  u16(0);
  u32(crc);
  u32(data.length);
  u32(data.length);
  u16(nameBytes.length);
  u16(0);
  u16(0);
  u16(0);
  u16(0);
  u32(0);
  u32(0);
  out.set(nameBytes, o);
  o += nameBytes.length;
  const centralSize = o - centralOffset;
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(1);
  u16(1);
  u32(centralSize);
  u32(centralOffset);
  u16(0);
  return out;
}

function parseStoredZip(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length > MAX_ZIP_BYTES)
    throw new Error('ZIP exceeds the calibrated supported size.');
  if (bytes.length < 98) throw new Error('ZIP is truncated.');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (off) => v.getUint16(off, true);
  const u32 = (off) => v.getUint32(off, true);
  const eocd = bytes.length - 22;
  if (u32(eocd) !== 0x06054b50 || u16(eocd + 20) !== 0)
    throw new Error('ZIP must end with one comment-free central directory.');
  if (
    u16(eocd + 4) !== 0 ||
    u16(eocd + 6) !== 0 ||
    u16(eocd + 8) !== 1 ||
    u16(eocd + 10) !== 1
  )
    throw new Error('ZIP must contain exactly one non-spanned entry.');
  const centralSize = u32(eocd + 12),
    centralOffset = u32(eocd + 16);
  if (centralOffset + centralSize !== eocd || centralOffset + 46 > eocd)
    throw new Error('ZIP central-directory bounds are inconsistent.');
  if (u32(centralOffset) !== 0x02014b50)
    throw new Error('ZIP central-directory signature is missing.');
  const madeBy = u16(centralOffset + 4),
    flags = u16(centralOffset + 8),
    method = u16(centralOffset + 10);
  const centralCrc = u32(centralOffset + 16),
    compressed = u32(centralOffset + 20),
    uncompressed = u32(centralOffset + 24);
  const nameLength = u16(centralOffset + 28),
    extraLength = u16(centralOffset + 30),
    commentLength = u16(centralOffset + 32);
  const external = u32(centralOffset + 38),
    localOffset = u32(centralOffset + 42);
  if (flags & 0x0001) throw new Error('Encrypted ZIP entries are rejected.');
  if (flags & 0x0008)
    throw new Error('ZIP data descriptors are not supported.');
  if ((flags & ~0x0800) !== 0) throw new Error('ZIP uses unsupported flags.');
  if (method !== 0) throw new Error('ZIP entry must use stored compression.');
  if (compressed !== uncompressed || uncompressed > MAX_JSON_BYTES)
    throw new Error(
      'ZIP declared size is invalid or exceeds the calibrated limit.',
    );
  if (madeBy >>> 8 === 3 && ((external >>> 16) & 0xf000) === 0xa000)
    throw new Error('ZIP symlink entries are rejected.');
  if (centralOffset + 46 + nameLength + extraLength + commentLength !== eocd)
    throw new Error(
      'ZIP contains trailing or duplicate central-directory data.',
    );
  let name;
  try {
    name = dec.decode(
      bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength),
    );
  } catch {
    throw new Error('ZIP filename is not valid UTF-8.');
  }
  if (
    name !== FINAL_ENTRY ||
    name.includes('..') ||
    name.startsWith('/') ||
    name.includes('\\')
  )
    throw new Error(`ZIP must contain exactly ${FINAL_ENTRY}.`);
  if (localOffset !== 0 || u32(localOffset) !== 0x04034b50)
    throw new Error('ZIP local-header offset or signature is invalid.');
  const localFlags = u16(6),
    localMethod = u16(8),
    localCrc = u32(14),
    localCompressed = u32(18),
    localUncompressed = u32(22);
  const localNameLength = u16(26),
    localExtraLength = u16(28);
  if (
    localFlags !== flags ||
    localMethod !== method ||
    localCrc !== centralCrc ||
    localCompressed !== compressed ||
    localUncompressed !== uncompressed
  )
    throw new Error('ZIP local and central metadata do not match.');
  let localName;
  try {
    localName = dec.decode(bytes.slice(30, 30 + localNameLength));
  } catch {
    throw new Error('ZIP local filename is not valid UTF-8.');
  }
  if (localName !== name || localNameLength !== nameLength)
    throw new Error('ZIP local and central filenames do not match.');
  const dataStart = 30 + localNameLength + localExtraLength;
  if (dataStart + compressed !== centralOffset)
    throw new Error('ZIP local entry bounds are inconsistent.');
  const data = bytes.slice(dataStart, dataStart + compressed);
  if (crc32(data) !== centralCrc) throw new Error('ZIP CRC check failed.');
  let text;
  try {
    text = dec.decode(data);
  } catch {
    throw new Error('Evidence JSON is not valid UTF-8.');
  }
  return { name, text, crc32: centralCrc, bytes: data };
}

export function validatePrelab(value) {
  const errors = validateEvidence(value);
  if (errors.length) throw new Error('Pre-lab evidence: ' + errors[0]);
  if (value.status !== 'finalized')
    throw new Error(
      'Finalize your pre-lab and download its submission ZIP first. Draft workspace backups are not evidence imports.',
    );
  return deepClone(value);
}
export function parsePrelab(bytes) {
  if (bytes.byteLength > MAX_ZIP_BYTES)
    throw new Error('The pre-lab exceeds its supported 2 MiB evidence limit.');
  const zipped = bytes[0] === 80 && bytes[1] === 75;
  if (!zipped && bytes.byteLength > MAX_JSON_BYTES)
    throw new Error('Pre-lab JSON exceeds 2 MiB.');
  let value;
  try {
    value = JSON.parse(zipped ? parseStoredZip(bytes).text : dec.decode(bytes));
  } catch (error) {
    throw new Error(
      'Choose the finalized pre-lab ZIP or prelab_evidence.json. ' +
        error.message,
    );
  }
  if (value?.backup_kind)
    throw new Error(
      'This is a pre-lab workspace backup. Finalize the pre-lab and download its submission ZIP instead.',
    );
  return validatePrelab(value);
}
