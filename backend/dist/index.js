import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/index.js';
import apiRouter from './routes/api.js';
import { initSocketIO } from './services/socketService.js';
import { SchedulerJob } from './jobs/scheduler.js';
import { runMigrations } from './db/migrate.js';
const app = express();
const server = http.createServer(app);
// Setup Socket.IO
const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
initSocketIO(io);
// Security & Middlewares
app.use(helmet({
    crossOriginResourcePolicy: false
}));
app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Mount API
app.use('/api', apiRouter);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    const status = err.status || 500;
    const message = config.nodeEnv === 'production' ? 'Internal server error' : (err.message || 'Error occurred');
    res.status(status).json({ error: message });
});
async function startServer() {
    try {
        // Ensure migrations on boot
        await runMigrations();
        // Start background scheduled tasks (no-show expiration and auto-completion)
        SchedulerJob.start();
        server.listen(config.port, () => {
            console.log(`===============================================`);
            console.log(`🚀 SmartLib Backend API running on port ${config.port}`);
            console.log(`🔗 Health Check: http://localhost:${config.port}/api/health`);
            console.log(`===============================================`);
        });
    }
    catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}
startServer();
// Handle graceful shutdown
process.on('SIGTERM', () => {
    SchedulerJob.stop();
    process.exit(0);
});
