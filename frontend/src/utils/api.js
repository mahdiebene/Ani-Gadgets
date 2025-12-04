const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Helper to handle API responses consistently
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Response wasn't JSON, use default message
    }
    throw new ApiError(errorMessage, response.status);
  }
  
  try {
    return await response.json();
  } catch {
    throw new ApiError('Invalid JSON response from server', response.status);
  }
}

/**
 * Fetch trending products with filters and pagination
 */
export async function fetchProducts(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.search) params.append('search', filters.search);
  if (filters.category) params.append('category', filters.category);
  if (filters.anime) params.append('anime', filters.anime);
  if (filters.minPrice) params.append('minPrice', filters.minPrice);
  if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  params.append('minScore', '0');
  
  // Pagination params
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  params.append('limit', String(limit));
  params.append('offset', String((page - 1) * limit));

  try {
    const response = await fetch(`${API_BASE_URL}/products?${params}`);
    const data = await handleResponse(response);
    
    // Return paginated response
    const products = data.data || [];
    const total = data.total || data.count || products.length;
    
    return {
      products,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network error
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * Fetch single product by ID
 */
export async function fetchProduct(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/products/${id}`);
    const data = await handleResponse(response);
    return data.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * Fetch trending anime list
 */
export async function fetchTrendingAnime() {
  try {
    const response = await fetch(`${API_BASE_URL}/anime`);
    const data = await handleResponse(response);
    return data.data || [];
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * Fetch platform statistics
 */
export async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);
    const data = await handleResponse(response);
    return data.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * Fetch categories
 */
export async function fetchCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/products/meta/categories`);
    const data = await handleResponse(response);
    return data.data || [];
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * Fetch anime names for filtering
 */
export async function fetchAnimeNames() {
  try {
    const response = await fetch(`${API_BASE_URL}/products/meta/anime`);
    const data = await handleResponse(response);
    return data.data || [];
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}
