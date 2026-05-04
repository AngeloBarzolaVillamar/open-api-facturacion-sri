/**
 * Standard API response interfaces
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  pagination: PaginationInfo | null;
}

export interface FileInfo {
  name: string;
  size: string;
  createdAt: Date;
  fileUrl: string;
}
