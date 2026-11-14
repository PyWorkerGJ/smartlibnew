import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
export const pool = mysql.createPool(config.db);
export async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}
export async function execute(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result;
}
export async function withTransaction(callback) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
