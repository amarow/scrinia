"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSystemTags = ensureSystemTags;
exports.createDefaultUserAndTags = createDefaultUserAndTags;
const client_1 = require("./client");
const PREDEFINED_TAGS = [
    { name: 'Bilder', color: '#4CAF50' },
    { name: 'Musik', color: '#FFC107' },
    { name: 'Text', color: '#2196F3' },
    { name: 'Video', color: '#9C27B0' },
    { name: 'Archive', color: '#795548' }, // Brown
    { name: 'Rest', color: '#607D8B' },
];
function ensureSystemTags(userId) {
    const stmt = client_1.db.prepare('INSERT OR IGNORE INTO Tag (userId, name, color, isEditable) VALUES (?, ?, ?, ?)');
    PREDEFINED_TAGS.forEach(tag => {
        stmt.run(userId, tag.name, tag.color, 0); // isEditable = 0 (false)
    });
    console.log(`Predefined tags checked/seeded for user ${userId}`);
}
function createDefaultUserAndTags() {
    // Check if default user exists
    let defaultUser = client_1.db.prepare('SELECT * FROM User WHERE username = ?').get('default');
    // If not, create default user
    if (!defaultUser) {
        const hashedPassword = 'dummy_password';
        const info = client_1.db.prepare('INSERT INTO User (username, password) VALUES (?, ?)').run('default', hashedPassword);
        defaultUser = { id: info.lastInsertRowid, username: 'default', password: hashedPassword };
        console.log('Default user created');
    }
    else {
        console.log('Default user already exists');
    }
    // Create predefined tags for default user
    ensureSystemTags(defaultUser.id);
}
