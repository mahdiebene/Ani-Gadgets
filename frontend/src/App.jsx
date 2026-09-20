import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import HomePage from './components/HomePage';
import BrowsePage from './components/BrowsePage';
import Footer from './components/Footer';
import BackToTop from './components/BackToTop';
import { fetchStats, fetchCategories } from './utils/api';
import { nextBrowseNavigation } from './utils/browse';

function App() {
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Page state: 'home' or 'browse'
  const [currentView, setCurrentView] = useState('home');
  const [browseConfig, setBrowseConfig] = useState({
    category: '',
    anime: '',
    sortBy: 'intelligent_score'
  });

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [statsData, categoriesData] = await Promise.all([
          fetchStats(),
          fetchCategories()
        ]);
        setStats(statsData);
        setCategories(categoriesData);
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    }
    loadInitialData();
  }, []);

  // Handle category pill click
  function handleCategorySelect(category) {
    setActiveCategory(category);
    if (category === 'All') {
      setCurrentView('home');
    } else {
      setBrowseConfig(previous => nextBrowseNavigation(previous, { category }));
      setCurrentView('browse');
    }
  }

  // Handle "View All" from category section
  function handleViewCategory(category, sortBy = 'intelligent_score') {
    if (category === 'All') {
      setActiveCategory('All');
      setBrowseConfig(previous => nextBrowseNavigation(previous, { sortBy }));
    } else {
      setActiveCategory(category);
      setBrowseConfig(previous => nextBrowseNavigation(previous, { category, sortBy }));
    }
    setCurrentView('browse');
  }

  // Handle "View All" from anime section
  function handleViewAnime(anime) {
    setActiveCategory('All');
    setBrowseConfig(previous => nextBrowseNavigation(previous, { anime }));
    setCurrentView('browse');
  }

  // Handle search
  function handleSearch(searchTerm) {
    if (searchTerm.trim()) {
      setActiveCategory('All');
      setBrowseConfig(previous => nextBrowseNavigation(previous, { search: searchTerm }));
      setCurrentView('browse');
    }
  }

  // Go back to home
  function handleBackToHome() {
    setActiveCategory('All');
    setCurrentView('home');
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Header onSearch={handleSearch} />
      
      {/* Hero with category pills - only show on home */}
      {currentView === 'home' && (
        <Hero 
          stats={stats} 
          categories={categories}
          activeCategory={activeCategory}
          onCategorySelect={handleCategorySelect}
        />
      )}
      
      <main>
        {currentView === 'home' ? (
          <HomePage 
            onViewCategory={handleViewCategory}
            onViewAnime={handleViewAnime}
          />
        ) : (
          <BrowsePage 
            key={browseConfig.revision}
            initialCategory={browseConfig.category}
            initialAnime={browseConfig.anime}
            initialSort={browseConfig.sortBy}
            initialSearch={browseConfig.search}
            onBack={handleBackToHome}
          />
        )}
      </main>
      
      <Footer />
      <BackToTop />
    </div>
  );
}

export default App;
