export type UserRole = "admin" | "editor" | "commenter" | "viewer";

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  access_tags?: Tag[];
}

export interface Course {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover_image_url?: string;
  is_protected: boolean;
  is_published: boolean;
  created_by: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  section_count?: number;
  page_count?: number;
  sections?: Section[];
}

export interface Section {
  id: number;
  course_id: number;
  title: string;
  slug: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  pages?: Page[];
}

export interface Page {
  id: number;
  section_id: number;
  title: string;
  slug: string;
  content?: string;
  content_html?: string;
  sort_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface PageVersion {
  id: number;
  page_id: number;
  version_number: number;
  content: string;
  content_hash: string;
  created_by: number;
  created_at: string;
}

export interface Comment {
  id: number;
  page_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

export interface Progress {
  user_id: number;
  page_id: number;
  completed_at: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  category: string;
  count?: number;
}

export interface CourseSummary extends Course {
  tags?: Tag[];
  completed_pages: number;
  total_pages: number;
  progress_pct: number;
  last_viewed_at?: string;
}

export interface DashboardData {
  total_courses: number;
  in_progress: CourseSummary[];
  recently_viewed: CourseSummary[];
  categories: Record<string, CourseSummary[]>;
}

export interface PaginatedCourses {
  courses: CourseSummary[];
  total_count: number;
  page: number;
  page_size: number;
}
