export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export const DEFAULT_PAGE_SIZE = 20;
