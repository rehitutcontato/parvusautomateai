/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize only if URL and Key are provided and URL is valid (to prevent crashing in environment without them initially)
const isValidUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');
export const supabase = isValidUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
