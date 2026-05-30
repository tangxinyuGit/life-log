// ============================================================
// API client – thin wrappers around fetch for the backend API
// ============================================================

import type {
  Category,
  CategoryCreate,
  CategoryUpdate,
  Entry,
  EntryCreate,
  EntryUpdate,
  EntryQueryParams,
  PaginatedEntries,
  Tag,
} from './types';

const API_BASE = '/api/v1';

// ---- helpers ------------------------------------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data.detail) {
        throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
      }
      throw new Error(JSON.stringify(data));
    } catch (err) {
      if (err instanceof Error && err.message !== text) throw err;
      throw new Error(text);
    }
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---- Categories ---------------------------------------------

export async function getCategories(includeArchived = false): Promise<Category[]> {
  const suffix = includeArchived ? '?include_archived=true' : '';
  return request<Category[]>(`/categories${suffix}`);
}

export async function createCategory(data: CategoryCreate): Promise<Category> {
  return request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(id: number, data: CategoryUpdate): Promise<Category> {
  return request<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function archiveCategory(id: number): Promise<void> {
  return request<void>(`/categories/${id}`, { method: 'DELETE' });
}

// ---- Entries ------------------------------------------------

export async function getEntries(params: EntryQueryParams): Promise<PaginatedEntries> {
  return request<PaginatedEntries>(
    `/entries${qs(params as Record<string, string | number | undefined>)}`,
  );
}

export async function createEntry(data: EntryCreate): Promise<Entry> {
  return request<Entry>('/entries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEntry(id: number, data: EntryUpdate): Promise<Entry> {
  return request<Entry>(`/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEntry(id: number): Promise<void> {
  return request<void>(`/entries/${id}`, { method: 'DELETE' });
}

// ---- Tags ---------------------------------------------------

export async function getTags(keyword?: string): Promise<Tag[]> {
  return request<Tag[]>(`/tags${qs({ keyword })}`);
}
