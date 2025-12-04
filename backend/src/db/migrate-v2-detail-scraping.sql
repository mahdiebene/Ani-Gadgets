-- ============================================================
-- Migration v2: Enhanced Product Data for Detail Scraping
-- ============================================================
-- INSTRUCTIONS: Copy this entire script and paste it into 
-- Supabase Dashboard > SQL Editor > New Query > Run
-- ============================================================

-- 1. Add columns for product identification
ALTER TABLE products ADD COLUMN IF NOT EXISTS daraz_product_id TEXT;

-- 2. Add columns for scrape status tracking
ALTER TABLE products ADD COLUMN IF NOT EXISTS scrape_status TEXT DEFAULT 'pending_details';
ALTER TABLE products ADD COLUMN IF NOT EXISTS scrape_error TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_scraped_at TIMESTAMPTZ;

-- 3. Add columns for seller info
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(3,2);

-- 4. Add columns for stock info
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'in_stock';
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;

-- 5. Add column for discount
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;

-- 6. Add columns for additional product data
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN DEFAULT false;

-- 7. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_scrape_status ON products(scrape_status);
CREATE INDEX IF NOT EXISTS idx_products_daraz_id ON products(daraz_product_id);
CREATE INDEX IF NOT EXISTS idx_products_needs_scoring_status ON products(needs_scoring, scrape_status);

-- 8. Mark all existing products for re-scrape with full details
UPDATE products 
SET scrape_status = 'pending_details',
    needs_scoring = true
WHERE scrape_status IS NULL;

-- 9. Verify - show all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
