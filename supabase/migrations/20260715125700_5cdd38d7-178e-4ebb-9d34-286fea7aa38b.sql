
-- 1. Add columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirm_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_date DATE,
  ADD COLUMN IF NOT EXISTS checkout_date DATE;

-- 2. Let authenticated users browse verified + active facilities
DROP POLICY IF EXISTS "Anyone auth can browse verified active facilities" ON public.storage_facilities;
CREATE POLICY "Anyone auth can browse verified active facilities"
ON public.storage_facilities
FOR SELECT
TO authenticated
USING (verification_status = 'verified' AND status = 'active');

-- 3. Facility owner can update bookings on their facility
DROP POLICY IF EXISTS "Facility owner updates facility bookings" ON public.bookings;
CREATE POLICY "Facility owner updates facility bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  facility_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.storage_facilities f
    WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
  )
)
WITH CHECK (
  facility_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.storage_facilities f
    WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
  )
);

-- 4. Safe capacity adjustment (protects against race conditions / negative values)
CREATE OR REPLACE FUNCTION public.adjust_facility_capacity(_facility_id UUID, _delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_val INTEGER;
BEGIN
  UPDATE public.storage_facilities
     SET available_capacity_crates = available_capacity_crates + _delta,
         updated_at = now()
   WHERE id = _facility_id
     AND available_capacity_crates + _delta >= 0
     AND available_capacity_crates + _delta <= total_capacity_crates
   RETURNING available_capacity_crates INTO new_val;

  IF new_val IS NULL THEN
    RAISE EXCEPTION 'capacity_adjustment_invalid';
  END IF;

  RETURN new_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_facility_capacity(UUID, INTEGER) TO authenticated;
