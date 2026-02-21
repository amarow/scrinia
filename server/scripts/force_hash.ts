import { db } from '../src/db/client';
import { fileService } from '../src/services/file.service';
import { fileRepository } from '../src/db/repository';

async function run() {
    console.log("--- Forced Hashing for Synced Shares ---");

    // 1. Find all files that are part of a synced share
    const filesToHash = db.prepare(`
        SELECT DISTINCT f.id, f.path, f.name 
        FROM FileHandle f
        JOIN _FileHandleToTag ft ON f.id = ft.A
        JOIN _ShareToTag st ON ft.B = st.B
        JOIN Share s ON st.A = s.id
        WHERE s.cloudSync = 1 AND f.hash IS NULL
    `).all() as any[];

    console.log(`Found ${filesToHash.length} files in synced shares that need hashing.`);

    let count = 0;
    for (const file of filesToHash) {
        try {
            const hash = await fileService.calculateHash(file.path);
            await fileRepository.updateHash(file.id, hash);
            count++;
            if (count % 10 === 0) {
                console.log(`Progress: ${count}/${filesToHash.length} hashed...`);
            }
        } catch (err: any) {
            console.error(`Failed to hash ${file.path}:`, err.message);
        }
    }

    console.log(`
Finished! Hashed ${count} files.`);
}

run().catch(console.error);
