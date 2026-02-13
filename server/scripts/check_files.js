const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../dev.db');
const db = new Database(dbPath);

try {
    const files = db.prepare("SELECT * FROM FileHandle WHERE extension = '.odt'").all();
    console.log(`Found ${files.length} .odt files.`);
    files.forEach(f => console.log(f.path));
    
    if (files.length > 0) {
        // Check content index
        const content = db.prepare("SELECT rowid, content FROM FileContentIndex WHERE rowid = ?").get(files[0].id);
        if (content) {
            console.log(`Content for ${files[0].path} (first 100 chars):`);
            console.log(content.content.substring(0, 100));
        } else {
            console.log(`No content indexed for ${files[0].path}`);
        }
    }
} catch (e) {
    console.error(e);
}
