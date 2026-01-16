require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const caseRoutes = require('./routes/cases.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const userRoutes = require('./routes/users.routes');

const errorHandler = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logger');

const app = express();

// Security middleware
app.use(helmet());

// CORS - allow multiple origins
const allowedOrigins = [
    'http://localhost:3000',
    'https://wacms.onrender.com',
    'https://wacms-frontend.onrender.com',
    process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Run migrations on startup (for Render/production)
const runMigrations = require('./migrations/run');

const startServer = async () => {
    try {
        // Run migrations before starting
        if (process.env.NODE_ENV === 'production') {
            console.log('🔄 Running database migrations...');
            await runMigrations();
            console.log('✅ Migrations complete');
        }

        const server = app.listen(PORT, () => {
            console.log(`🚀 WACMS Backend running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                console.log('Server closed.');
                process.exit(0);
            });
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
