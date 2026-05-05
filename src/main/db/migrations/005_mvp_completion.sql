-- Migration 005 — MVP completion fields.
--
-- Adds:
--   prospects.apollo_company       : Apollo's recorded current employer (for wrong-company cross-check at Phase 1.5)
--   prospects.apollo_title         : Apollo's recorded current title (for title-discrepancy detection)
--   prospects.apollo_employment    : full Apollo employment_history JSON (for career-arc detection)
--   evidence.experience_subpage    : Rung 4 — verbatim text from /details/experience/ subpage (Apr 30 BDR lock)
--   outreach.reply_classification  : P0-P4 verdict from the reply classifier
--   outreach.reply_classified_at   : when the classifier ran
--   outreach.tier                  : hook tier (A | A+ | A++) — surfaced in UI

ALTER TABLE prospects ADD COLUMN apollo_company TEXT;
ALTER TABLE prospects ADD COLUMN apollo_title TEXT;
ALTER TABLE prospects ADD COLUMN apollo_employment TEXT;        -- JSON array

ALTER TABLE evidence ADD COLUMN experience_subpage TEXT;        -- Rung 4 capture
ALTER TABLE evidence ADD COLUMN salesnav_lead_capture TEXT;     -- Rung 2/3 future

ALTER TABLE outreach ADD COLUMN reply_classification TEXT;      -- 'P0_warm' | 'P1_engaged' | 'P2_decline' | 'P3_auto_reply' | 'P4_hostile' | NULL
ALTER TABLE outreach ADD COLUMN reply_classified_at TEXT;
ALTER TABLE outreach ADD COLUMN tier TEXT;                      -- 'A' | 'A+' | 'A++' | NULL

-- Audit trail for auto-DNC additions (so the user can see why a row appeared).
ALTER TABLE dnc ADD COLUMN auto_added_from_outreach_id INTEGER;
ALTER TABLE dnc ADD COLUMN auto_added_reason_kind TEXT;         -- 'hostile_reply' | 'inc_030_burn' | 'manual'

CREATE INDEX IF NOT EXISTS idx_outreach_reply_classified ON outreach(user_id, reply_classification);
