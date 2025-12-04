import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-4 right-4 z-40 p-2
                 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
                 hover:border-[var(--color-accent)] text-[var(--color-text-secondary)]
                 hover:text-[var(--color-accent)]
                 transition-all duration-150
                 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
      aria-label="Back to top"
    >
      <ChevronUp className="w-4 h-4" />
    </button>
  );
}

export default BackToTop;
