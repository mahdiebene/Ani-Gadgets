import { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function Header({ onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { theme, toggleTheme } = useTheme();

  function handleSubmit(e) {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm);
    }
  }

  return (
    <header className="bg-[var(--color-bg-secondary)] sticky top-0 z-50 border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Main row - Logo, Search, Theme */}
        <div className="flex items-center gap-3 h-14">
          {/* Logo - always visible */}
          <a href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-[var(--color-accent)] flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M5 19V5l10 7-10 7z" fill="white"/>
                <path d="M9 19V5l10 7-10 7z" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-[var(--color-text-primary)] hidden sm:block tracking-tight">
              AnimeGadgets
            </span>
          </a>

          {/* Search - Always visible, expands on mobile */}
          <form onSubmit={handleSubmit} className="flex-1 min-w-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search anime merch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] 
                         py-2 px-3 pr-10 text-sm text-[var(--color-text-primary)] 
                         placeholder-[var(--color-text-muted)]
                         focus:outline-none focus:border-[var(--color-accent)]
                         transition-colors"
              />
              <button 
                type="submit"
                className="absolute right-0 top-0 h-full px-3 text-[var(--color-text-muted)] 
                         hover:text-[var(--color-accent)] transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center
                     text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] 
                     bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                     hover:border-[var(--color-accent)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
