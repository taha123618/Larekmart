// Types for navigation
export interface NavChild {
  label: string;
  to: string;
  icon: string;
}

export interface NavItem {
  label: string;
  icon: string;
  to: string;
  exact?: boolean;
  children?: NavChild[];
  badge?: number;
}

// API error shape
export interface ApiError {
  message: string;
  statusCode?: number;
  data?: unknown;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
