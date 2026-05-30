// ============================================================
// TypeScript interfaces matching the backend API schemas
// ============================================================

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface CategoryUpdate {
  name?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_archived?: boolean;
}

export interface Tag {
  id: number;
  name: string;
  created_at: string;
}

export interface Entry {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  category_id: number | null;
  note: string;
  mood: number | null;
  energy: number | null;
  tags: Tag[];
  category: {
    id: number;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface EntryCreate {
  title: string;
  start_time: string;
  end_time: string;
  category_id: number | null;
  tags?: string[];
  note?: string;
  mood?: number | null;
  energy?: number | null;
}

export interface EntryUpdate {
  title?: string;
  start_time?: string;
  end_time?: string;
  category_id?: number | null;
  tags?: string[];
  note?: string;
  mood?: number | null;
  energy?: number | null;
}

export interface EntryQueryParams {
  date?: string;
  start_date?: string;
  end_date?: string;
  category_id?: number;
  keyword?: string;
  tag?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedEntries {
  items: Entry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---- Stats ----

export interface DayStat {
  date: string;
  hours: number;
}

export interface CategoryStat {
  category_id: number | null;
  name: string;
  color: string;
  icon: string | null;
  hours: number;
  percentage: number;
}

export interface StatsSummary {
  total_hours: number;
  total_entries: number;
  active_days: number;
  avg_hours_per_active_day: number;
  by_day: DayStat[];
  by_category: CategoryStat[];
  mood: { average: number | null; count: number };
  energy: { average: number | null; count: number };
}
