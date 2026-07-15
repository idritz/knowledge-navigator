
-- Drop the previous helper function; we'll use a trigger instead.
DROP FUNCTION IF EXISTS public.adjust_facility_capacity(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.handle_booking_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_avail INTEGER;
BEGIN
  IF NEW.type <> 'storage' OR NEW.facility_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- pending -> confirmed: reserve capacity
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    UPDATE public.storage_facilities
       SET available_capacity_crates = available_capacity_crates - NEW.volume_crates,
           updated_at = now()
     WHERE id = NEW.facility_id
       AND available_capacity_crates - NEW.volume_crates >= 0
     RETURNING available_capacity_crates INTO new_avail;
    IF new_avail IS NULL THEN
      RAISE EXCEPTION 'insufficient_capacity';
    END IF;
  END IF;

  -- confirmed/in_progress -> completed or cancelled: release capacity
  IF OLD.status IN ('confirmed','in_progress')
     AND NEW.status IN ('completed','cancelled') THEN
    UPDATE public.storage_facilities
       SET available_capacity_crates = LEAST(total_capacity_crates,
              available_capacity_crates + NEW.volume_crates),
           updated_at = now()
     WHERE id = NEW.facility_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_capacity ON public.bookings;
CREATE TRIGGER trg_booking_capacity
BEFORE UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_capacity();
