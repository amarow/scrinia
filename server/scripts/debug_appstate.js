const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../dev.db');
const db = new Database(dbPath);

try {
    const row = db.prepare('SELECT * FROM AppState').all();
    console.log(JSON.stringify(row, null, 2));
} catch (e) {
    console.error(e);
}
