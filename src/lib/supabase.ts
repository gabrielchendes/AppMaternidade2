import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === "undefined") {
  console.warn("VITE_SUPABASE_URL is missing or undefined");
}

if (!supabaseAnonKey || supabaseAnonKey === "undefined") {
  console.warn("VITE_SUPABASE_ANON_KEY is missing or undefined");
}

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'undefined' && 
  supabaseAnonKey !== 'undefined' &&
  supabaseUrl !== '' &&
  supabaseAnonKey !== ''
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as any);

const supabaseServiceRoleKey = typeof process !== 'undefined' ? process.env?.SUPABASE_SERVICE_ROLE_KEY : undefined;

export const supabaseAdmin = (isSupabaseConfigured && supabaseServiceRoleKey && typeof window === 'undefined')
  ? createClient(supabaseUrl!, supabaseServiceRoleKey)
  : null;

export type Product = {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  pdf_url: string;
  price: number;
  is_free: boolean;
  is_active: boolean;
  is_bonus: boolean;
};

export type Purchase = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  user_avatar_url?: string;
  content: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_user_name?: string;
};

export type PostLike = {
  user_id: string;
  post_id: string;
};

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url?: string;
  content: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type PushToken = {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
};

export type CoursePackage = {
  id: string;
  title: string;
  hotmart_product_id?: string;
  hotmart_checkout_url?: string;
  description?: string;
  created_at: string;
  package_courses?: PackageCourse[];
};

export type PackageCourse = {
  package_id: string;
  course_id: string;
  created_at: string;
};


