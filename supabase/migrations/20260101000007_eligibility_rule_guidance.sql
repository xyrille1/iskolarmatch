-- FR14 (docs/PRD.md §4.2): curator-authored, plain-language guidance shown
-- for the single unmet mandatory rule in near-miss results ("what to work
-- on"). Nullable, populated per-rule via the admin eligibility-rules panel.
-- Never computed or AI-generated -- see PRD §4.5 (reaffirmed non-goals).
alter table eligibility_rules add column guidance_text text;
