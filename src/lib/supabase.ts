import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Lab {
  id: string;
  lab_name: string;
  logo_url: string | null;
}

export interface Appointment {
  id: number;
  lab_id: string;
  booking_id: string;
  name: string;
  age: number | null;
  gender: string | null;
  mobile: string;
  test: string;
  appointment_date: string;
  time: string | null;
  status: string;
  prescription_url: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
}
