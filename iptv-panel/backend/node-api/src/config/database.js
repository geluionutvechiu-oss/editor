const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'iptv_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iptv_panel',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  typeCast(field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      return field.string() === '1';
    }
    if (field.type === 'JSON') {
      const val = field.string();
      if (val === null) return null;
      try { return JSON.parse(val); } catch { return val; }
    }
    return next();
  }
});

pool.on('acquire', () => {});
pool.on('release', () => {});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function transaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, queryOne, transaction };
