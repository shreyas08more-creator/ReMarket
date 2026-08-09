/*
# ReMarket — Circular Economy Marketplace Schema

## Overview
Creates the core data model for ReMarket, a sustainable waste-trading platform
with dual-role authentication (customer / vendor), AI-assisted waste listings,
vendor pickup workflows, gamified impact tracking, and an integrated
second-hand store.

## New Tables

1. `profiles`
   - `id` (uuid, PK, FK -> auth.users, ON DELETE CASCADE)
   - `user_type` (text, 'customer' | 'vendor', NOT NULL)
   - `full_name` (text)
   - `avatar_url` (text)
   - `phone` (text)
   - `address` (text)
   - `eco_points` (int, default 0) — gamification currency
   - `kg_recycled` (numeric, default 0) — total kg diverted from landfill
   - `co2_saved_kg` (numeric, default 0) — estimated CO2 saved
   - `created_at` (timestamptz, default now())
   - One row per auth user, created on signup.

2. `waste_listings`
   - `id` (uuid, PK)
   - `user_id` (uuid, FK -> profiles, NOT NULL, DEFAULT auth.uid()) — the customer who posted the waste
   - `title` (text, NOT NULL)
   - `material_type` (text) — e.g. "Plastic PET", "Cardboard", "Aluminum"
   - `description` (text)
   - `image_url` (text)
   - `estimated_weight_kg` (numeric) — AI-estimated or user-entered weight
   - `estimated_price` (numeric) — AI-estimated or vendor-rate-derived buy-back price
   - `status` (text, 'pending' | 'scheduled' | 'completed', default 'pending')
   - `vendor_id` (uuid, FK -> profiles) — the vendor who claimed the listing
   - `pickup_date` (timestamptz) — scheduled pickup date
   - `created_at` (timestamptz, default now())

3. `vendor_rates`
   - `id` (uuid, PK)
   - `vendor_id` (uuid, FK -> profiles, NOT NULL, DEFAULT auth.uid())
   - `material_type` (text, NOT NULL)
   - `rate_per_kg` (numeric, NOT NULL)
   - `created_at` (timestamptz, default now())
   - UNIQUE (vendor_id, material_type)

4. `store_listings`
   - `id` (uuid, PK)
   - `seller_id` (uuid, FK -> profiles, NOT NULL, DEFAULT auth.uid())
   - `title` (text, NOT NULL)
   - `category` (text) — "Furniture" | "Books" | "Electronics" | "Household" | "Other"
   - `description` (text)
   - `image_url` (text)
   - `price` (numeric, NOT NULL, default 0)
   - `condition` (text) — "New" | "Like New" | "Good" | "Fair"
   - `status` (text, 'available' | 'sold', default 'available')
   - `created_at` (timestamptz, default now())

5. `store_inquiries`
   - `id` (uuid, PK)
   - `listing_id` (uuid, FK -> store_listings, ON DELETE CASCADE)
   - `buyer_id` (uuid, FK -> profiles, NOT NULL, DEFAULT auth.uid())
   - `message` (text)
   - `status` (text, 'pending' | 'accepted' | 'declined', default 'pending')
   - `created_at` (timestamptz, default now())

## Security (Row Level Security)
All tables have RLS enabled. Policies follow ownership / role rules:
- `profiles`: authenticated users can read any profile (vendors need to see
  customer names for pickups); users can UPDATE only their own row.
- `waste_listings`: authenticated can SELECT (vendors browse the feed);
  customers INSERT/UPDATE/DELETE their own; vendors can UPDATE listings they
  have claimed (vendor_id = auth.uid()) to schedule/complete pickups.
- `vendor_rates`: authenticated can SELECT (customers see buy-back rates);
  vendors CRUD their own rates.
- `store_listings`: authenticated can SELECT all; sellers INSERT/UPDATE/DELETE
  their own.
- `store_inquiries`: authenticated can SELECT inquiries they sent OR
  inquiries on listings they own; buyers INSERT their own; listing owners can
  UPDATE inquiry status.

## Important Notes
1. Owner columns default to `auth.uid()` so frontend inserts that omit the
   owner still satisfy INSERT WITH CHECK policies.
2. `profiles` is populated by the frontend immediately after signup.
3. Eco-impact columns on `profiles` are updated by the app when a waste
   listing transitions to 'completed'.
4. Email confirmation stays OFF — sign-in is email/password only.
*/

-- =========================================================
-- profiles
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL DEFAULT 'customer' CHECK (user_type IN ('customer', 'vendor')),
  full_name text,
  avatar_url text,
  phone text,
  address text,
  eco_points integer NOT NULL DEFAULT 0,
  kg_recycled numeric NOT NULL DEFAULT 0,
  co2_saved_kg numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated"
ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

ALTER TABLE profiles ALTER COLUMN user_type SET DEFAULT 'customer';
UPDATE profiles SET user_type = 'customer' WHERE user_type IS NULL;

CREATE OR REPLACE FUNCTION public.create_profile_from_auth_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (
    id,
    user_type,
    full_name,
    avatar_url,
    phone,
    address,
    eco_points,
    kg_recycled,
    co2_saved_kg,
    created_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer'),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    0,
    0,
    0,
    now()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_profile_on_user_signup ON auth.users;
CREATE TRIGGER create_profile_on_user_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_from_auth_user();

-- =========================================================
-- waste_listings
-- =========================================================
CREATE TABLE IF NOT EXISTS waste_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  material_type text,
  description text,
  image_url text,
  estimated_weight_kg numeric,
  estimated_price numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed')),
  vendor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  pickup_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE waste_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waste_select_authenticated" ON waste_listings;
CREATE POLICY "waste_select_authenticated"
ON waste_listings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "waste_insert_own" ON waste_listings;
CREATE POLICY "waste_insert_own"
ON waste_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "waste_update_own_or_claimed_vendor" ON waste_listings;
CREATE POLICY "waste_update_own_or_claimed_vendor"
ON waste_listings FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = vendor_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = vendor_id);

DROP POLICY IF EXISTS "waste_delete_own" ON waste_listings;
CREATE POLICY "waste_delete_own"
ON waste_listings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS waste_listings_status_idx ON waste_listings(status);
CREATE INDEX IF NOT EXISTS waste_listings_user_id_idx ON waste_listings(user_id);

-- =========================================================
-- vendor_rates
-- =========================================================
CREATE TABLE IF NOT EXISTS vendor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  material_type text NOT NULL,
  rate_per_kg numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, material_type)
);

ALTER TABLE vendor_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rates_select_authenticated" ON vendor_rates;
CREATE POLICY "rates_select_authenticated"
ON vendor_rates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rates_insert_own" ON vendor_rates;
CREATE POLICY "rates_insert_own"
ON vendor_rates FOR INSERT TO authenticated WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "rates_update_own" ON vendor_rates;
CREATE POLICY "rates_update_own"
ON vendor_rates FOR UPDATE TO authenticated
USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "rates_delete_own" ON vendor_rates;
CREATE POLICY "rates_delete_own"
ON vendor_rates FOR DELETE TO authenticated USING (auth.uid() = vendor_id);

-- =========================================================
-- store_listings
-- =========================================================
CREATE TABLE IF NOT EXISTS store_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  description text,
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  condition text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_select_authenticated" ON store_listings;
CREATE POLICY "store_select_authenticated"
ON store_listings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_insert_own" ON store_listings;
CREATE POLICY "store_insert_own"
ON store_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "store_update_own" ON store_listings;
CREATE POLICY "store_update_own"
ON store_listings FOR UPDATE TO authenticated
USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "store_delete_own" ON store_listings;
CREATE POLICY "store_delete_own"
ON store_listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS store_listings_status_idx ON store_listings(status);
CREATE INDEX IF NOT EXISTS store_listings_category_idx ON store_listings(category);

-- =========================================================
-- store_inquiries
-- =========================================================
CREATE TABLE IF NOT EXISTS store_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES store_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiry_select_owner_or_buyer" ON store_inquiries;
CREATE POLICY "inquiry_select_owner_or_buyer"
ON store_inquiries FOR SELECT TO authenticated
USING (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM store_listings
    WHERE store_listings.id = store_inquiries.listing_id
    AND store_listings.seller_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "inquiry_insert_own" ON store_inquiries;
CREATE POLICY "inquiry_insert_own"
ON store_inquiries FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "inquiry_update_listing_owner" ON store_inquiries;
CREATE POLICY "inquiry_update_listing_owner"
ON store_inquiries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM store_listings
    WHERE store_listings.id = store_inquiries.listing_id
    AND store_listings.seller_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM store_listings
    WHERE store_listings.id = store_inquiries.listing_id
    AND store_listings.seller_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS store_inquiries_listing_id_idx ON store_inquiries(listing_id);
CREATE INDEX IF NOT EXISTS store_inquiries_buyer_id_idx ON store_inquiries(buyer_id);
