-- AnimeGadgetsHub Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Trending Anime (kept for reference, but not used in main flow)
-- Stores anime data from MyAnimeList
CREATE TABLE IF NOT EXISTS trending_anime (
  id SERIAL PRIMARY KEY,
  mal_id INTEGER UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  title_english VARCHAR(255),
  image_url TEXT,
  score DECIMAL(4,2),
  members INTEGER DEFAULT 0,
  popularity_rank INTEGER,
  status VARCHAR(50),
  season VARCHAR(20),
  year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: Products
-- Stores scraped merchandise data with Layer 4 intelligent scoring
CREATE TABLE IF NOT EXISTS products (
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

-- Table 3: Platform Stats (for bot analytics)
CREATE TABLE IF NOT EXISTS platform_stats (
  id SERIAL PRIMARY KEY,
  stat_date DATE DEFAULT CURRENT_DATE,
  stat_type VARCHAR(50) NOT NULL,
  stat_key VARCHAR(100) NOT NULL,
  stat_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stat_date, stat_type, stat_key)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_intelligent_score ON products(intelligent_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_products_trending_score ON products(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_products_anime_name ON products(anime_name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_scraped_at ON products(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_needs_scoring ON products(needs_scoring) WHERE needs_scoring = true;
CREATE INDEX IF NOT EXISTS idx_products_last_seen ON products(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_times_seen ON products(times_seen DESC);
CREATE INDEX IF NOT EXISTS idx_anime_mal_id ON trending_anime(mal_id);
CREATE INDEX IF NOT EXISTS idx_anime_popularity ON trending_anime(popularity_rank);
CREATE INDEX IF NOT EXISTS idx_platform_stats_date ON platform_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_stats_type ON platform_stats(stat_type);

-- Row Level Security (RLS)
ALTER TABLE trending_anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on trending_anime" 
  ON trending_anime FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access on products" 
  ON products FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access on platform_stats" 
  ON platform_stats FOR SELECT 
  USING (true);

-- Allow authenticated insert/update (for bot operations)
-- Using anon key for now, you might want to use service role key for bot
CREATE POLICY "Allow insert on trending_anime" 
  ON trending_anime FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow update on trending_anime" 
  ON trending_anime FOR UPDATE 
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

CREATE POLICY "Allow insert on platform_stats" 
  ON platform_stats FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow update on platform_stats" 
  ON platform_stats FOR UPDATE 
  USING (true);

CREATE POLICY "Allow delete on platform_stats"
  ON platform_stats FOR DELETE
  USING (true);

-- Function to update updated_at timestamp
-- Setting search_path to empty string for security (prevents search_path injection)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for trending_anime
DROP TRIGGER IF EXISTS update_trending_anime_updated_at ON trending_anime;
CREATE TRIGGER update_trending_anime_updated_at
  BEFORE UPDATE ON trending_anime
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('trending_anime', 'products', 'platform_stats');
