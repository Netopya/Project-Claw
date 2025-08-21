# Project Claw - Anime Watchlist

A Node.js-based web application for managing a prioritized anime watchlist with MyAnimeList integration.

## Features

- Add anime to watchlist using MyAnimeList URLs
- Drag-and-drop reordering of anime priorities
- Local SQLite database storage
- Modern web interface with Astro and React

## Technology Stack

- **Frontend**: Astro with React components
- **Backend**: Hono API framework
- **Database**: SQLite with Drizzle ORM
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit

## Development Setup

### Using Docker (Recommended)

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your MyAnimeList API credentials
3. Run with Docker Compose:

```bash
npm run docker:dev
```

The application will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3001

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your MyAnimeList API credentials
```

3. Run the development servers:
```bash
# Frontend (Astro)
npm run dev

# API (Hono) - in another terminal
npm run api:dev
```

## Database Setup

The SQLite database will be automatically created when you first run the application. To manually run migrations:

```bash
npm run db:migrate
```

## MyAnimeList API Setup

1. Go to https://myanimelist.net/apiconfig
2. Create a new API application
3. Add your Client ID and Client Secret to the `.env` file

## Project Structure

```
src/
├── api/          # Hono API server and routes
├── components/   # React components
├── db/           # Database schema and utilities
├── pages/        # Astro pages
└── types/        # TypeScript type definitions
```