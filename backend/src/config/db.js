const { Pool } = require('pg');

// Support both DATABASE_URL (Render) and individual env vars (local)
const connectionConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'wacms',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
    ...connectionConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

/**
 * Execute a query with optional parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
    }

    return result;
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Pool client
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

module.exports = {
    query,
    getClient,
    pool
};
