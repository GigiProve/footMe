-- Migration: add an 'accepted' value to the application_status enum so clubs
-- can mark a candidate as accepted (spec: sent/viewed/shortlisted/rejected/accepted).
-- 'reviewing' already covers the "viewed/read" state. Additive only.
-- ALTER TYPE ... ADD VALUE pattern mirrors 20260317000000_add_agent_and_director_roles.sql.

alter type public.application_status add value if not exists 'accepted';
