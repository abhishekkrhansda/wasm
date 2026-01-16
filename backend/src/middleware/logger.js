/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            user: req.user?.id || 'anonymous'
        };

        if (process.env.NODE_ENV !== 'test') {
            console.log(`${log.method} ${log.path} ${log.status} ${log.duration} [${log.user}]`);
        }
    });

    next();
};

module.exports = { requestLogger };
