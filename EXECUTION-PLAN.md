# AnimeGadgetsHub - Execution Plan
## Builder: GitHub Copilot | Product Owner: You

---

## PROJECT OVERVIEW

**What I'll Build:** A trending anime gadgets discovery platform for Bangladesh
**Tech Stack:** React + Node.js/Express + PostgreSQL (Supabase) + Puppeteer
**Timeline:** 4-week MVP, then iterate

---

## ROLE DISTRIBUTION

### My Responsibilities (GitHub Copilot)
- ✅ Write all code (frontend, backend, scrapers)
- ✅ Set up database schema
- ✅ Create API endpoints
- ✅ Build the bot/scraper logic
- ✅ Implement scoring algorithm
- ✅ Design responsive UI
- ✅ Debug and fix issues

### Your Responsibilities (Product Owner)
- 🎯 Create accounts (Supabase, Vercel, Render, GitHub)
- 🎯 Register domain
- 🎯 Apply for Daraz affiliate program
- 🎯 Test the application
- 🎯 Provide feedback on UI/UX
- 🎯 Share with beta users
- 🎯 Content decisions (which anime to prioritize)
- 🎯 Run terminal commands I provide
- 🎯 Deploy when ready

---

## PHASE 1: PROJECT SETUP (Day 1)

### Step 1.1: You Create Accounts
**Action Required from You:**

1. **GitHub Repository**
   - Create a new repo: `animegadgetshub` (or name of your choice)
   - Make it private initially
   - Share the repo URL with me

2. **Supabase Account** (Free Database)
   - Go to: https://supabase.com
   - Create account
   - Create new project: `animegadgetshub`
   - Save these credentials:
     - Project URL
     - Anon/Public Key
     - Service Role Key (keep secret!)

3. **Vercel Account** (Frontend Hosting)
   - Go to: https://vercel.com
   - Sign up with GitHub

4. **Render Account** (Backend Hosting)
   - Go to: https://render.com
   - Sign up with GitHub

### Step 1.2: I Create Project Structure
Once you confirm accounts are ready, I'll create:

```
animegadgetshub/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductGrid.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Filters.jsx
│   │   │   └── ScoreBadge.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── About.jsx
│   │   ├── hooks/
│   │   │   └── useProducts.js
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/                  # Express API
│   ├── src/
│   │   ├── routes/
│   │   │   └── products.js
│   │   ├── services/
│   │   │   ├── scraper.js
│   │   │   ├── scorer.js
│   │   │   └── animeTracker.js
│   │   ├── db/
│   │   │   └── supabase.js
│   │   ├── utils/
│   │   │   └── helpers.js
│   │   └── index.js
│   ├── package.json
│   └── .env.example
│
├── bot/                      # Scraping bot (runs on schedule)
│   ├── src/
│   │   ├── scrapers/
│   │   │   └── daraz.js
│   │   ├── analyzers/
│   │   │   └── trendingAnime.js
│   │   └── index.js
│   ├── package.json
│   └── .env.example
│
├── .gitignore
├── README.md
└── EXECUTION-PLAN.md
```

---

## PHASE 2: CORE DEVELOPMENT (Days 2-7)

### Day 2: Database + Trending Anime Tracker

**What I'll Build:**
1. Supabase database schema (2 tables)
2. Trending anime fetcher (Jikan API - MyAnimeList)
3. Basic Express server

**Database Schema:**
```sql
-- Table 1: trending_anime
CREATE TABLE trending_anime (
  id SERIAL PRIMARY KEY,
  mal_id INTEGER UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  title_english VARCHAR(255),
  image_url TEXT,
  score DECIMAL(3,2),
  members INTEGER,
  popularity_rank INTEGER,
  status VARCHAR(50),
  season VARCHAR(20),
  year INTEGER,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: products
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  image_url TEXT,
  product_url TEXT NOT NULL,
  source VARCHAR(50) DEFAULT 'daraz',
  anime_title VARCHAR(255),
  anime_id INTEGER REFERENCES trending_anime(mal_id),
  reviews_count INTEGER DEFAULT 0,
  rating DECIMAL(2,1),
  trending_score INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  scraped_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_url)
);

-- Indexes for performance
CREATE INDEX idx_products_score ON products(trending_score DESC);
CREATE INDEX idx_products_anime ON products(anime_id);
CREATE INDEX idx_anime_popularity ON trending_anime(popularity_rank);
```

### Day 3-4: Daraz Scraper

**What I'll Build:**
1. Puppeteer-based scraper for Daraz.com.bd
2. Search by anime keywords
3. Extract: name, price, image, reviews, rating, URL
4. Store in database with deduplication

**Scraping Strategy:**
- Search terms: `[Anime Title] figure`, `[Anime Title] poster`, `[Character] merchandise`
- Rate limit: 1 request per 3 seconds
- User-Agent rotation
- Error handling for blocked requests

### Day 5: Scoring Algorithm

**What I'll Build:**
```javascript
const calculateTrendingScore = (product, anime) => {
  let score = 0;
  
  // Component 1: Anime Popularity (0-50 points)
  // Based on MAL score (1-10) and member count
  if (anime) {
    const malScore = anime.score || 0;
    const normalizedMAL = (malScore / 10) * 30; // 0-30 points
    
    const members = anime.members || 0;
    const memberScore = Math.min(members / 100000, 1) * 20; // 0-20 points
    
    score += normalizedMAL + memberScore;
  }
  
  // Component 2: Product Signals (0-35 points)
  const reviews = product.reviews_count || 0;
  const reviewScore = Math.min(reviews / 50, 1) * 15; // 0-15 points
  
  const rating = product.rating || 0;
  const ratingScore = (rating / 5) * 15; // 0-15 points
  
  const hasDiscount = product.original_price > product.price;
  const discountScore = hasDiscount ? 5 : 0; // 0-5 points
  
  score += reviewScore + ratingScore + discountScore;
  
  // Component 3: Freshness (0-15 points)
  const hoursSinceScraped = getHoursSince(product.scraped_at);
  const freshnessScore = hoursSinceScraped < 24 ? 15 :
                         hoursSinceScraped < 72 ? 10 :
                         hoursSinceScraped < 168 ? 5 : 0;
  
  score += freshnessScore;
  
  return Math.round(score);
};

// Only display products with score >= 60
```

### Day 6-7: Frontend Dashboard

**What I'll Build:**
1. React app with Vite
2. Product grid with cards
3. Trending score badges
4. Basic filters (category, price)
5. Mobile responsive design
6. "Buy on Daraz" affiliate-ready links

**UI Components:**
- `Header` - Logo, search bar
- `Filters` - Category, price range, sort by
- `ProductGrid` - Responsive grid of products
- `ProductCard` - Image, name, price, score badge, buy button
- `ScoreBadge` - Visual trending score (color-coded)

---

## PHASE 3: INTEGRATION & TESTING (Days 8-10)

### Day 8: Connect Everything

**What I'll Do:**
1. Connect frontend to backend API
2. Test full data flow: Bot → DB → API → Frontend
3. Add loading states and error handling
4. Implement search functionality

### Day 9: Testing & Bug Fixes

**What You'll Do:**
1. Test the application on your devices
2. Report any bugs or issues
3. Provide feedback on:
   - Product relevance (are these actually trending?)
   - Missing products
   - UI/UX improvements
   - Mobile experience

**What I'll Do:**
1. Fix reported bugs
2. Improve based on feedback
3. Optimize performance

### Day 10: Deployment Preparation

**What I'll Do:**
1. Create production environment configs
2. Prepare deployment scripts
3. Set up scheduled bot runs

**What You'll Do:**
1. Run deployment commands I provide
2. Set up environment variables in Vercel/Render
3. Test production site

---

## PHASE 4: LAUNCH (Days 11-14)

### Day 11-12: Soft Launch

**What You'll Do:**
1. Share with 5-10 friends/anime fans
2. Collect feedback
3. Report issues to me

**What I'll Do:**
1. Monitor for errors
2. Quick fixes for critical issues

### Day 13-14: Public Launch

**What You'll Do:**
1. Apply for Daraz affiliate (if not done)
2. Post on r/Bangladesh (helpful, not spammy)
3. Share in anime Discord/Facebook groups
4. Monitor traffic

**What I'll Do:**
1. Add affiliate link integration
2. Any final polish

---

## POST-LAUNCH ROADMAP

### Week 3: Enhancements
- Add Paperboat.shop scraper
- Improve scoring accuracy
- Add email signup for newsletter

### Week 4: Growth Features
- Blog section for SEO
- Price drop alerts
- User wishlist (if needed)

### Month 2+: Monetization
- Sponsored listings
- Premium features
- Content marketing

---

## IMMEDIATE NEXT STEPS

### For You (Do Now):
1. [ ] Create GitHub account (if not exists)
2. [ ] Create new GitHub repository
3. [ ] Create Supabase account + project
4. [ ] Create Vercel account
5. [ ] Create Render account
6. [ ] Reply with credentials (I'll tell you exactly what to share)

### For Me (Once You're Ready):
1. [ ] Create complete project structure
2. [ ] Build trending anime tracker
3. [ ] Build Daraz scraper
4. [ ] Build scoring system
5. [ ] Build frontend dashboard
6. [ ] Test and iterate

---

## COMMUNICATION PROTOCOL

**When you're ready to proceed, tell me:**
1. "Accounts created, ready to start"
2. Share Supabase project URL and anon key
3. Share GitHub repo URL

**When I complete a phase:**
1. I'll explain what I built
2. Provide commands for you to run
3. Ask for your testing/feedback

**When you find issues:**
1. Describe what happened
2. Share any error messages
3. Tell me what you expected vs. what happened

---

## LET'S BUILD THIS! 🚀

**Reply with "Ready to start" when you've created the accounts, or ask me any questions about the plan.**
