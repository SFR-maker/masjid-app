-- Add stripeChargesEnabled column to mosque_profiles
ALTER TABLE "mosque_profiles" ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
