import { shareRepository, fileRepository, privacyRepository } from '../db/repository';
import { db } from '../db/client';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

const RELAY_URL = process.env.RELAY_URL || 'http://localhost:3002';

export const syncService = {
    async syncAll() {
        console.log('[SYNC] Starting global sync cycle...');
        // Find all users who have cloudSync enabled on any share
        const usersWithSync = db.prepare('SELECT DISTINCT userId FROM Share WHERE cloudSync = 1').all() as { userId: number }[];
        
        for (const { userId } of usersWithSync) {
            await this.syncUserShares(userId);
        }
    },

    async syncUserShares(userId: number) {
        const shares = await shareRepository.getAll(userId);
        const syncedShares = shares.filter(s => s.cloudSync);

        if (syncedShares.length === 0) return;

        console.log(`[SYNC] Syncing ${syncedShares.length} shares for user ${userId}`);

        for (const share of syncedShares) {
            try {
                await this.syncShare(share);
            } catch (err: any) {
                console.error(`[SYNC] Failed to sync share ${share.id}:`, err.message);
            }
        }
    },

    async syncShare(share: any) {
        console.log(`[SYNC] Processing share: ${share.name} (${share.id})`);

        // 1. Get files for this share based on tags
        const files = await fileRepository.getAll(share.userId, share.tagIds);
        
        // Filter out files without hash
        const validFiles = files.filter(f => f.hash);
        
        // 2. Upload missing artifacts to Relay
        for (const file of validFiles) {
            await this.ensureArtifactOnRelay(file);
        }

        // 3. Prepare Privacy Config
        const privacyProfiles = await Promise.all(
            (share.privacyProfileIds || []).map((pid: number) => privacyRepository.getProfileWithRules(pid))
        );

        // 4. Send Share metadata to Relay
        const syncPayload = {
            shareId: share.id,
            token: share.key,
            name: share.name,
            privacyConfig: privacyProfiles,
            files: validFiles.map(f => ({ 
                hash: f.hash, 
                name: f.name,
                tags: f.tags ? f.tags.map((t: any) => t.name) : [] 
            }))
        };

        const res = await axios.post(`${RELAY_URL}/api/v1/sync`, syncPayload);
        
        if (res.data.success) {
            // Update lastSyncedAt locally
            db.prepare('UPDATE Share SET lastSyncedAt = CURRENT_TIMESTAMP WHERE id = ?').run(share.id);
            console.log(`[SYNC] Share ${share.name} successfully synchronized.`);
        }
    },

    async ensureArtifactOnRelay(file: any) {
        const { hash, path: filePath } = file;

        try {
            // Check if exists using HEAD
            await axios.head(`${RELAY_URL}/api/v1/artifacts/${hash}`);
            // If it doesn't throw, it exists (200 OK)
        } catch (err: any) {
            if (err.response && err.status === 404) {
                // Artifact missing, upload it
                console.log(`[SYNC] Uploading artifact ${file.name} (${hash})...`);
                
                const form = new FormData();
                form.append('file', fs.createReadStream(filePath));

                await axios.post(`${RELAY_URL}/api/v1/artifacts/${hash}`, form, {
                    headers: form.getHeaders()
                });
            } else {
                throw err;
            }
        }
    }
};
