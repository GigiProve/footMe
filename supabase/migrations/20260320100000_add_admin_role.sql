-- Add "admin" to app_role enum.
-- This role is NOT selectable during user registration — it can only be
-- assigned manually in the database by a platform administrator.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
