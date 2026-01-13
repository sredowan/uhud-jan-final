import mysql from 'mysql2/promise';

const url = 'mysql://u632925822_uhud_user:Redowan173123@203.89.124.226:3306/u632925822_uhud_db';

(async () => {
    try {
        console.log('Testing connection to:', url);
        const conn = await mysql.createConnection(url);
        await conn.ping();
        console.log('✅ Connected successfully to remote DB!');
        await conn.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }
})();
