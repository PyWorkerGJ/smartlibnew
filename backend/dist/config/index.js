import dotenv from 'dotenv';
dotenv.config();
export const config = {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'smartlib_default_secret_key_12345',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'smartlib_db',
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        timezone: 'Z',
        dateStrings: true
    }
};
