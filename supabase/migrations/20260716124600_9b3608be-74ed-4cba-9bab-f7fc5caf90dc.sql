
-- Add tricycle and car to vehicle_type enum
ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'tricycle';
ALTER TYPE public.vehicle_type ADD VALUE IF NOT EXISTS 'car';

-- match_method enum
DO $$ BEGIN
  CREATE TYPE public.match_method AS ENUM ('self_selected','admin_assisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add transport fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_region TEXT,
  ADD COLUMN IF NOT EXISTS destination_region TEXT,
  ADD COLUMN IF NOT EXISTS pickup_date DATE,
  ADD COLUMN IF NOT EXISTS vehicle_type_requested public.vehicle_type,
  ADD COLUMN IF NOT EXISTS match_method public.match_method;

-- Drivers can update bookings assigned to them (accept/decline/complete)
DROP POLICY IF EXISTS "Drivers update assigned bookings" ON public.bookings;
CREATE POLICY "Drivers update assigned bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Farmers can browse verified, available vehicles for matching
DROP POLICY IF EXISTS "Authenticated view available verified vehicles" ON public.vehicles;
CREATE POLICY "Authenticated view available verified vehicles" ON public.vehicles
  FOR SELECT TO authenticated
  USING (verification_status = 'verified' AND availability_status = 'available');

-- Allow authenticated to read basic profile info of others (needed to display
-- driver names/ratings in match results and counterparties in bookings).
DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;
CREATE POLICY "Authenticated view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
