# AnimeGadgetsHub

**Version 1.0.0** | Bangladesh's Anime Merchandise Discovery Platform

Discover trending anime merchandise in Bangladesh. A curated platform that uses intelligent scoring to surface the best anime gadgets from Daraz.

## Features

- **Intelligent Scoring** - Products scored 0-100 based on anime popularity, sales signals, and freshness
- **Curated Homepage** - Trending products, categories, and anime-specific sections
- **Smart Filtering** - Filter by category, anime series, price range
- **Dark/Light Mode** - Theme switching with system preference support
- **Mobile-First Design** - Optimized for mobile users

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)

## Project Structure

```
Ani-Gadgets/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── context/         # Theme context
│   │   ├── utils/           # Helper functions & API
│   │   └── App.jsx          # Main app component
│   └── package.json
│
├── backend/                  # Express API
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── db/              # Database connection
│   └── package.json
│
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/products` | Get products with filtering & pagination |
| `GET /api/products/:id` | Get single product |
| `GET /api/anime` | Get anime list |
| `GET /api/categories` | Get category list |
| `GET /api/stats` | Get platform statistics |

## Scoring Algorithm

Products are scored 0-100 based on:

- **Anime Popularity (50%)** - MAL score + member count
- **Product Signals (35%)** - Reviews, ratings, discounts
- **Freshness (15%)** - How recently scraped

Only products scoring **60+** are displayed.

## License

MIT

MIT

## Contributing

Pull requests welcome!

---

Made with ❤️ for anime fans in Bangladesh
