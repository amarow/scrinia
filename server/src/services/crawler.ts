import { fileRepository, scopeRepository, searchRepository, appStateRepository } from '../db/repository';
import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';

// --- Worker Pool Implementation ---

interface WorkerTask {
    filePath: string;
    extension: string;
    fileId: number;
    resolve: (val: any) => void;
    reject: (err: any) => void;
}

class CrawlerWorkerPool {
    private workers: Worker[] = [];
    private taskQueue: WorkerTask[] = [];
    private activeWorkers: number = 0;
    private maxWorkers: number = 8; // User requested 8 cores
    private workerScript: string;

    constructor() {
        // Determine correct path and execution args based on environment (ts-node vs node)
        const isTsNode = __filename.endsWith('.ts');
        this.workerScript = isTsNode 
            ? path.join(__dirname, 'crawler.worker.ts') 
            : path.join(__dirname, 'crawler.worker.js');
    }

    private getWorkerOptions() {
        const isTsNode = __filename.endsWith('.ts');
        return isTsNode ? {
            execArgv: ['-r', 'ts-node/register']
        } : {};
    }

    public processFile(filePath: string, extension: string, fileId: number): Promise<{ text: string | null }> {
        return new Promise((resolve, reject) => {
            const task: WorkerTask = { filePath, extension, fileId, resolve, reject };
            this.scheduleTask(task);
        });
    }

    private scheduleTask(task: WorkerTask) {
        if (this.activeWorkers < this.maxWorkers) {
            this.runTask(task);
        } else {
            this.taskQueue.push(task);
        }
    }

    private runTask(task: WorkerTask) {
        this.activeWorkers++;
        
        // Lazy initialization of workers or reuse?
        // For simplicity and robustness, let's spawn a new worker or grab from a pool.
        // Actually, creating a Worker per file is expensive. We should keep them alive.
        // Let's implement a simple persistent pool.
        
        let worker: Worker;

        if (this.workers.length < this.maxWorkers) {
             worker = new Worker(this.workerScript, this.getWorkerOptions());
             this.workers.push(worker);
             
             // Setup generic listener for this worker to handle pool logic?
             // No, standard pool pattern: Assign task to specific worker.
             // But 'Worker' is an actor.
             
             // Refined approach:
             // 1. We have N workers.
             // 2. We send a message to a free worker.
             // 3. When worker replies, we mark it free and assign next task.
        } else {
            // This branch shouldn't be reached if we check activeWorkers correctly vs pool size
            // But if we reuse workers, we need to find an idle one.
            // Simplified: Just use activeWorkers count to throttle, but we need reference to the *idle* worker.
        }
        
        // Actually, with the "Request/Response" pattern on a single channel per worker:
        // Let's rewrite slightly to manage the *Worker Instances* explicitly.
    }
}

// Simplified Pool for specific use case
const MAX_WORKERS = 8;
const workerPool: Worker[] = [];
const taskQueue: WorkerTask[] = [];
const idleWorkers: Worker[] = [];

function initPool() {
    const isTsNode = __filename.endsWith('.ts');
    const workerScript = isTsNode 
            ? path.join(__dirname, 'crawler.worker.ts') 
            : path.join(__dirname, 'crawler.worker.js');
    const options = isTsNode ? { execArgv: ['-r', 'ts-node/register'] } : {};

    for (let i = 0; i < MAX_WORKERS; i++) {
        const worker = new Worker(workerScript, options);
        worker.on('message', (message) => {
            // Find the task that corresponds to this message? 
            // Or simpler: The worker processes one thing at a time. 
            // We need to map the worker back to the promise.
            // We can store a 'currentTask' on the worker object (casted to any).
            
            const currentTask = (worker as any).currentTask as WorkerTask;
            if (currentTask) {
                if (message.status === 'success') {
                    currentTask.resolve({ text: message.text });
                } else {
                    currentTask.resolve({ text: null }); // Resolve null on error to keep going
                }
                (worker as any).currentTask = null;
            }

            // Worker is done, check queue
            if (taskQueue.length > 0) {
                const nextTask = taskQueue.shift()!;
                assignTaskToWorker(worker, nextTask);
            } else {
                idleWorkers.push(worker);
            }
        });
        
        worker.on('error', (err) => {
            console.error('[WORKER ERROR]', err);
            // If a worker dies, we should probably replace it, but for now just log.
             const currentTask = (worker as any).currentTask as WorkerTask;
             if (currentTask) currentTask.resolve({ text: null });
        });

        workerPool.push(worker);
        idleWorkers.push(worker);
    }
}

function assignTaskToWorker(worker: Worker, task: WorkerTask) {
    (worker as any).currentTask = task;
    worker.postMessage({ filePath: task.filePath, extension: task.extension, fileId: task.fileId });
}

function processFileWithWorker(filePath: string, extension: string, fileId: number): Promise<{ text: string | null }> {
    return new Promise((resolve, reject) => {
        const task: WorkerTask = { filePath, extension, fileId, resolve, reject };
        
        if (idleWorkers.length > 0) {
            const worker = idleWorkers.pop()!;
            assignTaskToWorker(worker, task);
        } else {
            taskQueue.push(task);
        }
    });
}

// Initialize pool on module load or first use
// We'll call it in init()
let poolInitialized = false;

// --- End Worker Pool ---

const initializedUsers = new Set<number>();

export const crawlerService = {
  async init() {
    console.log('[CRAWLER] Initializing base service...');
    if (!poolInitialized) {
        initPool();
        poolInitialized = true;
        console.log(`[CRAWLER] Worker pool initialized with ${MAX_WORKERS} threads.`);
    }
  },

  async initUser(userId: number) {
    if (initializedUsers.has(userId)) return;
    
    console.log(`[CRAWLER] Initializing scopes for user ${userId}...`);
    const scopes = await scopeRepository.getAll(userId);
    for (const s of scopes) {
        const scope = s as { id: number, path: string };
        console.log(`[CRAWLER] Triggering background scan for scope ${scope.id} (${scope.path})`);
        this.scanScope(scope.id, scope.path).catch(err => {
             console.error(`[CRAWLER] Error scanning scope ${scope.id} for user ${userId}:`, err);
        });
    }
    initializedUsers.add(userId);
  },

  async addScope(userId: number, directoryPath: string) {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`Directory not found: ${directoryPath}`);
    }
    const scope = await scopeRepository.create(userId, directoryPath);
    this.scanScope(scope.id, directoryPath); 
    return scope;
  },

  async scanScope(scopeId: number, directoryPath: string) {
    console.log(`[CRAWLER] Starting scan for scope ${scopeId}: ${directoryPath}`);
    
    const scopeObj = await scopeRepository.getById(scopeId) as { userId: number } | undefined;
    if (!scopeObj) { console.error(`[CRAWLER] Scope ${scopeId} not found`); return; }

    const appState = await appStateRepository.get(scopeObj.userId);
    const searchSettings = appState && appState.search_settings ? appState.search_settings : {};
    
    // Expanded default allowed extensions
    const allowedExtensions = searchSettings.allowedExtensions || 
        ['.txt', '.md', '.markdown', '.json', '.ts', '.js', '.jsx', '.tsx', '.html', '.css', '.scss', '.xml', '.yaml', '.yml', '.sql', '.env', '.pdf', '.docx', '.odt'];
    
    let fileCount = 0;
    let ignoredCount = 0;
    let skippedCount = 0;
    const foundFileIds: number[] = [];
    const startTime = Date.now();
    const queue: { path: string, depth: number }[] = [{ path: directoryPath, depth: 0 }];

    // We keep track of pending worker tasks to know when the scan is fully complete
    let pendingWorkerTasks = 0;

    const processQueue = async () => {
        // If file system queue is empty
        if (queue.length === 0) {
            // Check if we are waiting for workers
            if (pendingWorkerTasks > 0) {
                // Check again in a bit
                setTimeout(processQueue, 100); 
                return;
            }

            // Prune files not found in this scan
            console.log(`[CRAWLER] Pruning deleted files for scope ${scopeId}...`);
            const deletedCount = await fileRepository.pruneFiles(scopeId, foundFileIds);
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[CRAWLER] Finished scan for scope ${scopeId}. Total: ${fileCount} files. Skipped (unchanged): ${skippedCount}. Deleted: ${deletedCount}. Ignored: ${ignoredCount} items. Time: ${duration}s.`);
            return;
        }

        const current = queue.shift()!;
        
        try {
            const entries = await fs.promises.readdir(current.path, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(current.path, entry.name);
                
                if (entry.name.startsWith('.') || 
                    ['node_modules', 'dist', 'build', 'coverage', 'target', 'venv', '__pycache__'].includes(entry.name)) {
                    ignoredCount++;
                    continue;
                }

                if (entry.isDirectory()) {
                    if (current.depth < 20) {
                        queue.push({ path: fullPath, depth: current.depth + 1 });
                    } else {
                        console.log(`[CRAWLER] Max depth reached at ${fullPath}`);
                        ignoredCount++;
                    }
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.promises.stat(fullPath);
                        const mtimeStr = stats.mtime.toISOString();

                        // Optimization: Check if file already exists with same mtime and size
                        // AND check if content is indexed (for supported files)
                        // AND check if hash is already present
                        const existing = fileRepository.getFileMinimal(scopeId, fullPath);
                        const ext = path.extname(fullPath).toLowerCase();
                        
                        // Check if we SHOULD have content for this file
                        const isAllowed = allowedExtensions.includes(ext);
                        const isSupportedType = ['.txt', '.md', '.markdown', '.json', '.pdf', '.docx', '.odt', '.xml', '.html', '.ts', '.js', '.jsx', '.tsx', '.css', '.scss', '.yaml', '.yml', '.sql', '.env'].includes(ext);
                        
                        // Treat as new if content is missing for supported types that are allowed
                        const contentMissing = isAllowed && isSupportedType && (existing && !existing.hasContent);
                        const hashMissing = existing && !existing.hash;

                        if (existing && existing.updatedAt === mtimeStr && existing.size === stats.size && !contentMissing && !hashMissing) {
                            skippedCount++;
                            fileCount++; // Still count as "processed" in total
                            foundFileIds.push(existing.id);
                        } else {
                            const fileId = await fileRepository.upsertFile(scopeId, fullPath, { 
                                size: stats.size, 
                                ctime: stats.ctime, 
                                mtime: stats.mtime 
                            });
                            foundFileIds.push(fileId);
                            
                            // We now ALWAYS want the hash for Relay
                            pendingWorkerTasks++;
                            
                            // Offload to worker
                            processFileWithWorker(fullPath, ext, fileId).then(async (result: any) => {
                                if (result.hash) {
                                    await fileRepository.updateHash(fileId, result.hash);
                                }
                                if (result.text) {
                                    try {
                                        await searchRepository.indexContent(fileId, result.text);
                                    } catch (err) {
                                        console.error(`[CRAWLER] Failed to index content for ${fullPath}:`, err);
                                    }
                                }
                            }).catch(err => {
                                console.error(`[CRAWLER] Worker error for ${fullPath}:`, err);
                            }).finally(() => {
                                pendingWorkerTasks--;
                            });
                            
                            fileCount++;
                        }
                        
                        if (fileCount % 1000 === 0) {
                            console.log(`[CRAWLER] Scope ${scopeId}: Found ${fileCount} files (Skipped ${skippedCount})...`);
                        }
                    } catch (err) {
                        // ignore individual file errors
                    }
                }
            }
        } catch (err) {
            console.error(`[CRAWLER] Error scanning ${current.path}:`, err);
        }

        // Throttle file system scanning slightly to allow workers to catch up if queue is huge?
        // Actually, with setImmediate, we yield enough.
        setImmediate(processQueue);
    };

    processQueue();
  }
};