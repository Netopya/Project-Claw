import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { initializeDatabase } from '../db/connection.js';
import { animeRoutes } from './routes/anime.js';
import { healthRoutes } from './routes/health.js';
import { timelineRoutes } from './routes/timeline.js';

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Routes
app.route('/api/health', healthRoutes);
app.route('/api/anime', animeRoutes);
app.route('/api/timeline', timelineRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Project Claw API',
    version: '1.0.0',
    description: 'Anime watchlist management API',
    endpoints: {
      health: '/api/health',
      anime: '/api/anime',
      timeline: '/api/timeline',
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  
  return c.json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  }, 500);
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Project Claw API server...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // Start server
    const port = parseInt(process.env.PORT || '3001', 10);
    
    console.log(`🌟 Server running on http://localhost:${port}`);
    console.log('📚 API Documentation available at http://localhost:' + port);
    
    return { port };
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Export for testing and external use
export { app, startServer };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().then(async ({ port }) => {
    // Start HTTP server using Hono Node.js adapter
    const { serve } = await import('@hono/node-server');
    
    serve({
      fetch: app.fetch,
      port,
    });
    
    console.log(`🎯 Server is listening on port ${port}`);
  }).catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}