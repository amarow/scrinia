"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsController = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
exports.FsController = {
    async pickDirectory(req, res) {
        try {
            let command = '';
            if (process.platform === 'linux') {
                command = 'zenity --file-selection --directory --title="Select Directory to Watch"';
            }
            else if (process.platform === 'win32') {
                command = 'powershell -command "& { $App = New-Object -ComObject Shell.Application; $Folder = $App.BrowseForFolder(0, \'Select Directory to Watch\', 0); if ($Folder) { $Folder.Self.Path } }"';
            }
            else if (process.platform === 'darwin') {
                command = 'osascript -e "POSIX path of (choose folder with prompt \\"Select Directory to Watch\\")"';
            }
            if (!command) {
                return res.status(501).json({ error: 'Directory picker not supported on this platform' });
            }
            const { stdout } = await execAsync(command);
            const selectedPath = stdout.trim();
            if (!selectedPath)
                return res.status(204).end(); // User cancelled
            res.json({ path: selectedPath });
        }
        catch (e) {
            if (e.code === 1)
                return res.status(204).end(); // User cancelled zenity
            res.status(500).json({ error: e.message });
        }
    },
    async list(req, res) {
        try {
            let dirPath = req.query.path;
            if (!dirPath)
                dirPath = os_1.default.homedir();
            try {
                await fs.access(dirPath, fs.constants.R_OK);
            }
            catch {
                return res.status(403).json({ error: 'Access denied or path invalid' });
            }
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const directories = entries
                .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
                .map(entry => ({
                name: entry.name,
                path: path.join(dirPath, entry.name),
                isDir: true
            }))
                .sort((a, b) => a.name.localeCompare(b.name));
            const parentDir = path.dirname(dirPath);
            if (parentDir !== dirPath) {
                directories.unshift({
                    name: '..',
                    path: parentDir,
                    isDir: true
                });
            }
            res.json({ currentPath: dirPath, entries: directories });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};
