-- SAFE MIGRATION: Add new columns to existing products table
-- This preserves your existing 399 products!
-- Run this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Add ALL new columns to products table
-- =====================================================

-- Layer 4 Intelligent Scoring columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS intelligent_score DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS score_explanation TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS score_version INTEGER DEFAULT 1;

-- Trending status columns (for display labels)
ALTER TABLE products ADD COLUMN IF NOT EXISTS trending_status VARCHAR(20) DEFAULT 'low';
ALTER TABLE products ADD COLUMN IF NOT EXISTS trending_label VARCHAR(50);

-- Multi-bot tracking columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS needs_scoring BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS times_seen INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- =====================================================
-- STEP 2: Create new indexes (IF NOT EXISTS)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_intelligent_score 
ON products(intelligent_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_products_needs_scoring 
ON products(needs_scoring) WHERE needs_scoring = true;

CREATE INDEX IF NOT EXISTS idx_products_last_seen 
ON products(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_times_seen 
ON products(times_seen DESC);

-- =====================================================
-- STEP 3: Create platform_stats table (new)
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_stats (
  id SERIAL PRIMARY KEY,
  stat_date DATE DEFAULT CURRENT_DATE,
  stat_type VARCHAR(50) NOT NULL,
  stat_key VARCHAR(100) NOT NULL,
  stat_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stat_date, stat_type, stat_key)
);

-- Indexes for platform_stats
CREATE INDEX IF NOT EXISTS idx_platform_stats_date 
ON platform_stats(stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_platform_stats_type 
ON platform_stats(stat_type);

-- =====================================================
-- STEP 4: Enable RLS on platform_stats
-- =====================================================

ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (to avoid errors), then recreate
DROP POLICY IF EXISTS "Allow public read access on platform_stats" ON platform_stats;
DROP POLICY IF EXISTS "Allow insert on platform_stats" ON platform_stats;
DROP POLICY IF EXISTS "Allow update on platform_stats" ON platform_stats;
DROP POLICY IF EXISTS "Allow delete on platform_stats" ON platform_stats;

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

-- =====================================================
-- STEP 5: Add delete policy on products (if missing)
-- =====================================================

DROP POLICY IF EXISTS "Allow delete on products" ON products;

CREATE POLICY "Allow delete on products"
  ON products FOR DELETE
  USING (true);

-- =====================================================
-- STEP 6: Mark all existing products for scoring
-- =====================================================

UPDATE products 
SET needs_scoring = true, 
    times_seen = 1,
    last_seen_at = COALESCE(scraped_at, NOW())
WHERE needs_scoring IS NULL OR needs_scoring = false;

-- =====================================================
-- VERIFY MIGRATION
-- =====================================================

SELECT 
  'Migration complete!' as status,
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM products WHERE needs_scoring = true) as products_to_score,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'intelligent_score') as has_intelligent_score_column;
