import { db } from '../src/db/client';
import { syncService } from '../src/services/sync.service';
import axios from 'axios';

async function check() {
    console.log("--- Sync Diagnostic ---");
    
    // 1. Check Shares
    const syncedShares = db.prepare('SELECT id, name, cloudSync FROM Share WHERE cloudSync = 1').all() as any[];
    console.log(`Active Sync Shares: ${syncedShares.length}`);
    syncedShares.forEach(s => console.log(` - [${s.id}] ${s.name}`));

    if (syncedShares.length === 0) {
        console.log("WAIT: No shares have 'cloudSync' enabled. Please enable it in the UI.");
        return;
    }

    // 2. Check File Hashes
    const filesWithHash = db.prepare('SELECT COUNT(*) as count FROM FileHandle WHERE hash IS NOT NULL').get() as { count: number };
    const filesWithoutHash = db.prepare('SELECT COUNT(*) as count FROM FileHandle WHERE hash IS NULL').get() as { count: number };
    console.log(`Files with Hash: ${filesWithHash.count}`);
    console.log(`Files without Hash: ${filesWithoutHash.count}`);

    // 3. Check Relay Connectivity
    try {
        const res = await axios.get('http://localhost:3002/health');
        console.log("Relay Status:", res.data.status);
    } catch (e: any) {
        console.log("ERROR: Relay server not reachable on http://localhost:3002");
    }

    // 4. Manually trigger a sync for the first share
    console.log("\n--- Triggering Manual Sync for first share ---");
    try {
        const firstShare = syncedShares[0];
        const fullShare = db.prepare('SELECT * FROM Share WHERE id = ?').get(firstShare.id) as any;
        // Mock the required properties for syncShare
        fullShare.tagIds = db.prepare('SELECT B as tagId FROM _ShareToTag WHERE A = ?').all(fullShare.id).map((r: any) => r.tagId);
        
        await syncService.syncShare(fullShare);
        console.log("Manual Sync call finished.");
    } catch (err: any) {
        console.error("Manual Sync FAILED:", err.message);
        if (err.response) console.error("Response data:", err.response.data);
    }
}

check().catch(console.error);
