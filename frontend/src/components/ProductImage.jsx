import { useState } from 'react';

function ProductImage({ src, alt, className = '' }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(alt?.slice(0, 2) || 'AG')}&background=1a1a24&color=6366f1&size=300&font-size=0.4&bold=true`;

  return (
    <div className={`relative overflow-hidden bg-[var(--color-bg-tertiary)] ${className}`}>
      {/* Placeholder/Loading state */}
      {!loaded && !error && (
        <div className="absolute inset-0 skeleton" />
      )}
      
      {/* Actual image */}
      <img
        src={error ? fallbackSrc : (src || fallbackSrc)}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        className={`w-full h-full object-cover img-zoom transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export default ProductImage;
