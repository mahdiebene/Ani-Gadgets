-- Migration: Update products table for multi-bot system with Layer 4 scoring
-- Run this in Supabase SQL Editor

-- Step 1: Drop the old table and recreate
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS platform_stats CASCADE;

-- Step 2: Create new products table with Layer 4 scoring fields
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  image_url TEXT,
  product_url TEXT NOT NULL UNIQUE,
  source VARCHAR(50) DEFAULT 'daraz',
  anime_name VARCHAR(255),
  search_keyword VARCHAR(255),
  category VARCHAR(100),
  reviews_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  
  -- Legacy scoring (from scraper)
  trending_score INTEGER DEFAULT 0,
  trending_status VARCHAR(20) DEFAULT 'low',
  trending_label VARCHAR(50),
  
  -- Layer 4 Intelligent Scoring fields (set by scorer bot)
  intelligent_score DECIMAL(5,2),
  score_breakdown JSONB,
  score_explanation TEXT,
  score_version INTEGER DEFAULT 1,
  
  -- Multi-bot tracking fields
  needs_scoring BOOLEAN DEFAULT true,
  times_seen INTEGER DEFAULT 1,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create platform_stats table for bot analytics
CREATE TABLE platform_stats (
  id SERIAL PRIMARY KEY,
  stat_date DATE DEFAULT CURRENT_DATE,
  stat_type VARCHAR(50) NOT NULL,
  stat_key VARCHAR(100) NOT NULL,
  stat_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stat_date, stat_type, stat_key)
);

-- Step 4: Create indexes for products
CREATE INDEX idx_products_intelligent_score ON products(intelligent_score DESC NULLS LAST);
CREATE INDEX idx_products_trending_score ON products(trending_score DESC);
CREATE INDEX idx_products_anime_name ON products(anime_name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_products_scraped_at ON products(scraped_at DESC);
CREATE INDEX idx_products_needs_scoring ON products(needs_scoring) WHERE needs_scoring = true;
CREATE INDEX idx_products_last_seen ON products(last_seen_at DESC);
CREATE INDEX idx_products_times_seen ON products(times_seen DESC);

-- Step 5: Create indexes for platform_stats
CREATE INDEX idx_platform_stats_date ON platform_stats(stat_date DESC);
CREATE INDEX idx_platform_stats_type ON platform_stats(stat_type);

-- Step 6: Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- Step 7: Create policies for products
CREATE POLICY "Allow public read access on products" 
  ON products FOR SELECT 
  USING (true);

CREATE POLICY "Allow insert on products" 
  ON products FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow update on products" 
  ON products FOR UPDATE 
  USING (true);

CREATE POLICY "Allow delete on products"
  ON products FOR DELETE
  USING (true);

-- Step 8: Create policies for platform_stats
CREATE POLICY "Allow public read access on platform_stats" 
  ON platform_stats FOR SELECT 
  USING (true);

CREATE POLICY "Allow insert on platform_stats" 
  ON platform_stats FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow update on platform_stats" 
  ON platform_stats FOR UPDATE 
  USING (true);

CREATE POLICY "Allow delete on platform_stats"
  ON platform_stats FOR DELETE
  USING (true);

-- Verify
SELECT 'Products table recreated with Layer 4 scoring and multi-bot support!' as status;
