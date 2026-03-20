-- Add "admin" to app_role enum (not selectable during registration, set manually in DB).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- Add "rejected" to club verification statuses and add audit trail columns.

-- Update constraint to include "rejected"
ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_verification_status_values;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_verification_status_values
  CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'flagged', 'suspended', 'rejected'));

-- Generic audit trail for any admin review action (approve or reject).
-- The existing verified_by / verified_at columns are kept for backward compatibility
-- and continue to be set only on approval.
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
