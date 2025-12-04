import { useState } from 'react';

function CategoryPills({ categories = [], activeCategory = 'All', onSelect }) {
  const allCategories = ['All', ...categories.filter(c => c !== 'All')];

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
      {allCategories.map((category) => {
        const isActive = activeCategory === category;
        
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={`
              px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0
              ${isActive 
                ? 'bg-[var(--color-accent)] text-white' 
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]'
              }
            `}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

export default CategoryPills;
