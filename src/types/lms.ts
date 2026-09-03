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
  subtitle?: string;
  old_price?: number;
  benefits?: string[];
  cta_text?: string;
  preview_url?: string;
  preview_text?: string;
  preview_enabled?: boolean;
  checkout_url?: string;
  hotmart_product_id?: string;
  premium_cover_url?: string;
  premium_badge_text?: string;
  offer_badge_text?: string;
  social_proof?: string;
  show_lifetime_badge?: boolean;
  lifetime_badge_text?: string;
  payment_label_text?: string;
  secure_payment_label?: string;
  instant_access_label?: string;
  preview_rating?: string;
  preview_students_label?: string;
  preview_guarantee_label?: string;
  preview_support_vip_label?: string;
  preview_bonus_title?: string;
  preview_show_social_proof?: boolean;
  preview_show_bonus?: boolean;
  preview_show_trust?: boolean;
  preview_support_type?: 'floating' | 'box';
  preview_title?: string;
  preview_subtitle?: string;
  preview_type?: 'video' | 'pdf' | 'text' | 'link';
  preview_link_text?: string;
  preview_link_url?: string;
  preview_link_color?: string;
  preview_video_url?: string;
  preview_pdf_url?: string;
  preview_rich_text?: string;
  preview_modules_label?: string;
  preview_students_tag?: string;
  preview_risk_zero_label?: string;
  preview_support_label?: string;
  preview_guarantee_title?: string;
  preview_guarantee_subtitle?: string;
  preview_guarantee_description?: string;
  preview_footer_cta?: string;
  order_index?: number;
  linked_package_id?: string;
  is_package_exclusive_bonus?: boolean;
  created_at: string;
  tenant_id: string;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  description?: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  module_id: string;
  course_id?: string;
  title: string;
  description: string;
  content_type: 'video' | 'pdf' | 'text' | 'link' | 'checklist' | 'interactive' | 'html_app';
  video_url?: string;
  pdf_url?: string;
  cover_url?: string;
  rich_text?: string;
  button_link_text?: string;
  button_link_url?: string;
  button_link_color?: string;
  duration_minutes?: number;
  order_index: number;
  is_preview: boolean;
  is_free?: boolean;
  created_at: string;
}

export interface InteractiveLessonContent {
  title?: string;
  description?: string;
  duration_minutes?: number;
  language?: string; // e.g. 'en', 'pt-BR', 'es', 'fr' (default: 'en')
  blocks: LessonBlock[];
}

export type LessonBlockType =
  | 'text'
  | 'video'
  | 'pdf'
  | 'checklist'
  | 'quiz'
  | 'reflection'
  | 'action_plan'
  | 'button_link'
  | 'exercise'
  | 'ai_analyzer'
  | 'tracker'
  | 'calculator'
  | 'simulator'
  | 'readiness_evaluator'
  | 'comparison'
  | 'timeline'
  | 'chart';

export interface LessonBlockItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  day?: string;
  required?: boolean;
  options?: string[]; // for quiz / simulator
  correct_option_index?: number; // for quiz
  explanation?: string; // for quiz / simulator feedback
  consequences?: Record<number, string>; // for simulator options -> consequences
  weight?: number; // for readiness evaluator / calculator
  before_text?: string; // for comparison
  after_text?: string; // for comparison
}

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  title?: string;
  description?: string;
  content?: string; // rich text or markdown
  url?: string;
  items?: LessonBlockItem[];
  instructions?: string;
  placeholder?: string; // for reflection / ai_analyzer input
  button_text?: string;
  button_url?: string;
  button_color?: string;
  // AI Analyzer configuration
  analyzer_type?: 'temperature' | 'sentiment' | 'text' | 'custom';
  analyzer_criteria?: string;
  // Tracker configuration (No-Contact / Challenge / Daily tracker)
  tracker_label?: string;
  tracker_target_days?: number;
  tracker_milestones?: { day: number; title: string; reward_badge?: string }[];
  // Readiness Evaluator / Calculator config
  result_tiers?: { min_score: number; max_score: number; title: string; recommendation: string; color?: string }[];
}

export interface UserBlockProgress {
  user_id: string;
  chapter_id: string;
  block_id: string;
  item_id?: string;
  completed?: boolean;
  answer_text?: string;
  selected_option_index?: number;
  updated_at?: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id?: string;
  chapter_id?: string;
  title: string;
  description?: string;
  category?: string;
  sort_order: number;
  required: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface Checklist {
  id?: string;
  chapter_id: string;
  title: string;
  description?: string;
  instructions?: string;
  image_url?: string;
  items: ChecklistItem[];
  created_at?: string;
  updated_at?: string;
}

export interface UserChecklistProgress {
  id?: string;
  user_id: string;
  chapter_id: string;
  checklist_id?: string;
  item_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface UserProgress {
  user_id: string;
  chapter_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface ChapterQuestion {
  id: string;
  chapter_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url?: string;
  question: string;
  answer?: string;
  is_read_by_admin: boolean;
  answered_at?: string;
  answered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CoursePackage {
  id: string;
  title: string;
  price?: number;
  hotmart_product_id?: string;
  hotmart_checkout_url?: string;
  description?: string;
  created_at: string;
  package_courses?: { course_id: string }[];
}
