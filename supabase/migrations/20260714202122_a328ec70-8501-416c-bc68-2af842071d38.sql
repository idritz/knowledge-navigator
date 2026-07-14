
-- Enums
CREATE TYPE public.user_role AS ENUM ('farmer', 'driver', 'facility_owner', 'admin');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE public.facility_verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.facility_status AS ENUM ('active', 'paused');
CREATE TYPE public.power_source AS ENUM ('solar', 'grid', 'hybrid');
CREATE TYPE public.vehicle_type AS ENUM ('motorcycle', 'van', 'truck');
CREATE TYPE public.vehicle_availability AS ENUM ('available', 'on_job', 'offline');
CREATE TYPE public.booking_type AS ENUM ('storage', 'transport');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'farmer',
  full_name TEXT NOT NULL DEFAULT '',
  phone_number TEXT UNIQUE,
  region TEXT,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Storage Facilities
CREATE TABLE public.storage_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_text TEXT NOT NULL,
  total_capacity_crates INTEGER NOT NULL,
  available_capacity_crates INTEGER NOT NULL,
  price_per_crate_per_day NUMERIC(10,2) NOT NULL,
  power_source public.power_source NOT NULL DEFAULT 'solar',
  verification_status public.facility_verification_status NOT NULL DEFAULT 'pending',
  status public.facility_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_facilities TO authenticated;
GRANT ALL ON public.storage_facilities TO service_role;
ALTER TABLE public.storage_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their facilities" ON public.storage_facilities
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type public.vehicle_type NOT NULL,
  capacity_kg INTEGER NOT NULL,
  home_region TEXT NOT NULL,
  availability_status public.vehicle_availability NOT NULL DEFAULT 'offline',
  verification_status public.facility_verification_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers manage their vehicles" ON public.vehicles
  FOR ALL TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.booking_type NOT NULL,
  farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.storage_facilities(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  crop_type TEXT NOT NULL,
  volume_crates INTEGER NOT NULL,
  duration_days INTEGER,
  status public.booking_status NOT NULL DEFAULT 'pending',
  price_quoted NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farmers see their bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers create bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = farmer_id);
CREATE POLICY "Farmers update their bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (auth.uid() = farmer_id);
CREATE POLICY "Driver sees assigned bookings" ON public.bookings
  FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "Facility owner sees facility bookings" ON public.bookings
  FOR SELECT TO authenticated USING (
    facility_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.storage_facilities f
      WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_facilities_updated BEFORE UPDATE ON public.storage_facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup, reading role from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta_role public.user_role;
BEGIN
  BEGIN
    meta_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'farmer');
  EXCEPTION WHEN OTHERS THEN
    meta_role := 'farmer';
  END;
  -- Never allow self-signup as admin
  IF meta_role = 'admin' THEN meta_role := 'farmer'; END IF;

  INSERT INTO public.profiles (id, role, full_name, phone_number, region)
  VALUES (
    NEW.id,
    meta_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'region'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
