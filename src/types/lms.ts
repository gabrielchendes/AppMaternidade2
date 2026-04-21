export interface Course {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  price: number;
  is_free: boolean;
  is_bonus: boolean;
  is_active: boolean;
  category?: string;
  pdf_url?: string;
  checkout_url?: string;
  hotmart_product_id?: string;
  created_at: string;
  tenant_id: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
}

export interface Chapter {
  id: string;
  module_id: string;
  title: string;
  description: string;
  content_type: 'video' | 'pdf' | 'text';
  video_url?: string;
  pdf_url?: string;
  cover_url?: string;
  rich_text?: string;
  duration_minutes?: number;
  order_index: number;
  is_preview: boolean;
  created_at: string;
}

export interface UserProgress {
  user_id: string;
  chapter_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface CoursePackage {
  id: string;
  title: string;
  hotmart_product_id?: string;
  hotmart_checkout_url?: string;
  description?: string;
  created_at: string;
  package_courses?: { course_id: string }[];
}
