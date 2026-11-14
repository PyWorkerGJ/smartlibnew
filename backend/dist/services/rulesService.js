import { pool } from '../db/pool.js';
const rulesCache = {};
let lastFetched = 0;
export async function getBookingRules() {
    const now = Date.now();
    if (now - lastFetched < 10000 && Object.keys(rulesCache).length > 0) {
        return rulesCache;
    }
    const [rows] = await pool.query('SELECT rule_key, rule_value FROM booking_rules');
    for (const row of rows) {
        rulesCache[row.rule_key] = row.rule_value;
    }
    lastFetched = now;
    return rulesCache;
}
export async function getRuleNumber(key, defaultValue) {
    const rules = await getBookingRules();
    const val = rules[key];
    if (!val)
        return defaultValue;
    const num = parseInt(val, 10);
    return isNaN(num) ? defaultValue : num;
}
