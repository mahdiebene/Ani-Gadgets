export function createBrowseFilters({ category = '', anime = '', search = '', sortBy = 'intelligent_score' } = {}) {
  return { search: search.trim(), category, anime, source: '', minPrice: '', maxPrice: '', sortBy, sortOrder: 'desc' };
}

// A revision resets Browse even when the same header search is submitted again.
export function nextBrowseNavigation(previous, config) {
  return { ...createBrowseFilters(config), revision: (previous.revision || 0) + 1 };
}