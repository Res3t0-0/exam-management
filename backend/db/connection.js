// db/connection.js
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'exam_management',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  dateStrings: true, // return DATE/DATETIME as plain strings (avoids timezone shift + ISO 'Z' rejected on PUT)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const db = pool.promise();

// Test connection
pool.getConnection((err, conn) => {
  if (err) {
    console.error('❌ DB Connection Failed:', err.message);
  } else {
    console.log('✅ MySQL Connected to exam_management');
    conn.release();
  }
});

module.exports = db;
