// Convex schema — migrated 1:1 from the self-hosted SQLite DB (33 tables).
//
// Migration principles:
// - `legacyId` preserves the old SQLite integer PK so foreign keys
//   (session_id, supplement_id, doc_id, chunk_id, checkin_id, report_id) can be
//   remapped to Convex Ids during ETL, and so the existing app logic can
//   transition without a big-bang id rewrite.
// - `userId` keeps the legacy integer user id (multi-tenant scoping key). The
//   Foyer/household isolation invariant is enforced in the query/mutation layer
//   (convex/lib/auth.ts), never trusted from the client.
// - Fields marked "// ENCRYPTED" hold app-layer ciphertext (lib/crypto-fields).
//   Convex only ever stores ciphertext for medical-sensitive values; the key
//   stays on the VPS. This is why full-text search on those fields is not done
//   in Convex (RAG stays VPS-side).
// - Nullable SQLite columns -> v.optional(...). Booleans stored as 0/1 integers
//   are kept as v.number() for 1:1 fidelity with the source data.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  user: defineTable({
    legacyId: v.number(),
    email: v.string(),
    hash: v.string(), // bcrypt — auth stays iron-session until Phase 8
    secret: v.string(),
    role: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_legacy", ["legacyId"])
    .index("by_email", ["email"]),

  biomarker: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    name: v.string(),
    slug: v.string(),
    category: v.optional(v.string()),
    value: v.number(), // ENCRYPTED-CANDIDATE (kept numeric for now; index by slug/date only)
    unit: v.optional(v.string()),
    refLow: v.optional(v.number()),
    refHigh: v.optional(v.number()),
    date: v.number(),
    source: v.optional(v.string()),
    rawText: v.optional(v.string()), // ENCRYPTED (raw lab text)
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_user_slug_date", ["userId", "slug", "date"]),

  dna_insight: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    rsid: v.string(),
    category: v.string(),
    trait: v.string(),
    effect: v.optional(v.string()),
    magnitude: v.optional(v.number()),
    riskAllele: v.optional(v.string()),
    userGenotype: v.optional(v.string()), // ENCRYPTED
    hasRisk: v.optional(v.number()),
    isProtective: v.optional(v.number()),
    summary: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "category"])
    .index("by_user_rsid", ["userId", "rsid"]),

  // 1.8M rows in prod. Heavy on Convex Cloud (cost + import time). Table is
  // defined so it CAN be migrated, but ETL for it is deferred — raw SNPs stay
  // VPS-side and are queried on demand; only dna_insight (derived) is hot.
  dna_variant: defineTable({
    userId: v.number(),
    rsid: v.string(),
    chromosome: v.string(),
    position: v.number(),
    genotype: v.string(), // ENCRYPTED-CANDIDATE
  })
    .index("by_user", ["userId"])
    .index("by_user_rsid", ["userId", "rsid"]),

  profile: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    data: v.string(), // ENCRYPTED (already field-encrypted JSON blob)
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  report: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    kind: v.string(),
    title: v.string(),
    body: v.string(), // ENCRYPTED (report markdown)
    meta: v.optional(v.string()),
    createdAt: v.number(),
    // Async generation state — the VPS worker flips this via HTTP mutation.
    status: v.optional(v.string()), // 'pending' | 'done' (new rows); legacy rows omit
  })
    .index("by_user", ["userId"])
    .index("by_user_kind", ["userId", "kind"]),

  blood_report: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    panelDate: v.number(),
    body: v.string(), // ENCRYPTED
    generatedAt: v.number(),
  }).index("by_user", ["userId"]),

  action_plan: defineTable({
    legacyId: v.number(),
    userId: v.optional(v.number()),
    plan: v.string(), // ENCRYPTED
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  supplement: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    name: v.string(),
    dose: v.optional(v.string()),
    unit: v.optional(v.string()),
    timing: v.optional(v.string()),
    frequency: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    targetBiomarker: v.optional(v.string()),
    targetSnp: v.optional(v.string()),
    createdAt: v.number(),
    url: v.optional(v.string()),
    brand: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.optional(v.string()),
    servingSize: v.optional(v.string()),
    suggestedUse: v.optional(v.string()),
    price: v.optional(v.string()),
    duration: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  supplement_log: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    supplementLegacyId: v.number(), // FK -> supplement.legacyId (remapped in ETL)
    date: v.string(),
    taken: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_supplement", ["supplementLegacyId"]),

  note: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    targetType: v.string(),
    targetId: v.string(),
    body: v.string(), // ENCRYPTED
    tags: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_target", ["userId", "targetType", "targetId"]),

  symptom_log: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    date: v.string(),
    key: v.string(),
    value: v.number(),
    notes: v.optional(v.string()), // ENCRYPTED
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  habit_log: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    date: v.string(),
    key: v.string(),
    value: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  wearable_metric: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    date: v.string(),
    source: v.string(),
    kind: v.string(),
    value: v.number(),
    unit: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_kind", ["userId", "kind"])
    .index("by_user_date_source_kind", ["userId", "date", "source", "kind"]),

  nutrition_pref: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    dietType: v.string(),
    allergies: v.string(),
    aversions: v.string(),
    budget: v.string(),
    cuisines: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  document: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    path: v.string(),
    category: v.string(),
    title: v.optional(v.string()),
    date: v.optional(v.number()),
    pages: v.optional(v.number()),
    textContent: v.optional(v.string()), // ENCRYPTED
    hash: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_path", ["path"]),

  // RAG stays authoritative on the VPS (encrypted content can't be full-text
  // searched in Convex). Tables defined for completeness / optional mirror.
  rag_chunk: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    docLegacyId: v.number(), // FK -> document.legacyId
    chunkIdx: v.number(),
    text: v.string(), // ENCRYPTED
    tokens: v.optional(v.number()),
    embedding: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_doc", ["docLegacyId"]),

  rag_keyword: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    chunkLegacyId: v.number(), // FK -> rag_chunk.legacyId
    term: v.string(),
    tf: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_chunk", ["chunkLegacyId"]),

  chat_session: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  chat_message: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    sessionLegacyId: v.number(), // FK -> chat_session.legacyId
    role: v.string(),
    content: v.string(), // ENCRYPTED
    sources: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionLegacyId"]),

  chat_memory: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    kind: v.string(),
    body: v.string(), // ENCRYPTED
    sourceSessionId: v.optional(v.number()),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
    active: v.number(),
  }).index("by_user", ["userId"]),

  reminder: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.number(),
    category: v.optional(v.string()),
    done: v.optional(v.number()),
    createdAt: v.number(),
    notifiedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_due", ["dueAt"]),

  push_subscription: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  card_feedback: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    reportLegacyId: v.number(), // FK -> report.legacyId
    cardIndex: v.number(),
    cardTitle: v.string(),
    rating: v.string(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_report", ["reportLegacyId"]),

  share_link: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    token: v.string(),
    scope: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    views: v.optional(v.number()),
    lastViewedAt: v.optional(v.number()),
    revoked: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  weekly_checkin: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    weekIso: v.string(),
    weekStart: v.number(),
    notes: v.optional(v.string()), // ENCRYPTED
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_week", ["userId", "weekIso"]),

  weekly_habit: defineTable({
    checkinLegacyId: v.number(), // FK -> weekly_checkin.legacyId
    key: v.string(),
    countOutOf7: v.number(),
  }).index("by_checkin", ["checkinLegacyId"]),

  weekly_symptom: defineTable({
    checkinLegacyId: v.number(), // FK -> weekly_checkin.legacyId
    key: v.string(),
    avgValue: v.number(),
  }).index("by_checkin", ["checkinLegacyId"]),

  ingest_log: defineTable({
    legacyId: v.number(),
    userId: v.number(),
    kind: v.string(),
    status: v.string(),
    detail: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // legacyId is optional from here down: it only ever identified a row in the
  // old SQLite file. Rows created natively in Convex have no legacy counterpart,
  // so they omit it. (On `user` it stays required — there it is the actual user
  // id referenced across the whole schema, not a migration artifact.)
  audit: defineTable({
    legacyId: v.optional(v.number()),
    userId: v.optional(v.number()),
    action: v.string(),
    target: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  audit_log: defineTable({
    legacyId: v.number(),
    action: v.string(),
    detail: v.optional(v.string()),
    ip: v.optional(v.string()),
    ua: v.optional(v.string()),
    createdAt: v.number(),
  }),

  password_reset: defineTable({
    legacyId: v.optional(v.number()),
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    used: v.number(),
    createdAt: v.number(),
  }).index("by_token", ["tokenHash"]),

  waitlist: defineTable({
    legacyId: v.optional(v.number()),
    email: v.string(),
    createdAt: v.number(),
    invitedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  // household_link — the Foyer consent graph. Directional viewer->subject.
  // Isolation invariant lives in convex/lib/auth.ts. (Table existed in migrate.ts
  // but had no rows yet in this snapshot.)
  household_link: defineTable({
    legacyId: v.optional(v.number()),
    viewerUserId: v.number(),
    subjectUserId: v.number(),
    label: v.optional(v.string()),
    relationship: v.optional(v.string()),
    status: v.string(), // 'pending' | 'active'
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_viewer", ["viewerUserId"])
    .index("by_subject", ["subjectUserId"])
    .index("by_pair", ["viewerUserId", "subjectUserId"]),
});
