import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'customer' | 'vendor';

export type Profile = {
  id: string;
  user_type: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  eco_points: number;
  kg_recycled: number;
  co2_saved_kg: number;
  created_at: string;
};

export type WasteListingStatus = 'pending' | 'scheduled' | 'completed';

export type WasteListing = {
  id: string;
  user_id: string;
  title: string;
  material_type: string | null;
  description: string | null;
  image_url: string | null;
  estimated_weight_kg: number | null;
  estimated_price: number | null;
  status: WasteListingStatus;
  vendor_id: string | null;
  pickup_date: string | null;
  created_at: string;
};

export type VendorRate = {
  id: string;
  vendor_id: string;
  material_type: string;
  rate_per_kg: number;
  created_at: string;
};

export type StoreListing = {
  id: string;
  seller_id: string;
  title: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  price: number;
  condition: string | null;
  status: 'available' | 'sold';
  created_at: string;
};

export type StoreInquiry = {
  id: string;
  listing_id: string;
  buyer_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};
