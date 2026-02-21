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
exports.fileService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const heic_convert_1 = __importDefault(require("heic-convert"));
const mammoth_1 = __importDefault(require("mammoth"));
const pdf = require('pdf-parse');
exports.fileService = {
    async extractText(filePath, extension) {
        const ext = extension.toLowerCase();
        try {
            if (ext === '.pdf') {
                const dataBuffer = await fs.readFile(filePath);
                // Suppress annoying console warnings from pdf-parse/pdf.js (e.g. "Warning: TT: undefined function: 32")
                const originalLog = console.log;
                const originalWarn = console.warn;
                const suppress = (...args) => {
                    const msg = args.join(' ');
                    if (msg.includes('Warning: TT: undefined function: 32'))
                        return;
                    originalLog.apply(console, args);
                };
                console.log = suppress;
                console.warn = suppress;
                try {
                    const data = await pdf(dataBuffer);
                    return data.text;
                }
                finally {
                    console.log = originalLog;
                    console.warn = originalWarn;
                }
            }
            if (ext === '.docx') {
                const result = await mammoth_1.default.extractRawText({ path: filePath });
                return result.value;
            }
            if (ext === '.odt') {
                const zip = new adm_zip_1.default(filePath);
                const contentXml = zip.readAsText('content.xml');
                if (contentXml) {
                    let formatted = contentXml;
                    formatted = formatted.replace(/<text:p[^>]*>/g, '\n\n')
                        .replace(/<text:h[^>]*text:outline-level="1"[^>]*>/g, '\n\n# ')
                        .replace(/<text:h[^>]*text:outline-level="2"[^>]*>/g, '\n\n## ')
                        .replace(/<text:h[^>]*text:outline-level="3"[^>]*>/g, '\n\n### ')
                        .replace(/<text:h[^>]*>/g, '\n\n# ')
                        .replace(/<text:tab\/>/g, '    ')
                        .replace(/<text:line-break\/>/g, '\n');
                    return formatted.replace(/<[^>]+>/g, '').trim();
                }
                return "";
            }
            // Default: Read as plain text
            return await fs.readFile(filePath, 'utf8');
        }
        catch (e) {
            console.error(`Error extracting text from ${filePath}:`, e);
            return "";
        }
    },
    async convertHeicToJpeg(filePath) {
        const inputBuffer = await fs.readFile(filePath);
        const outputBuffer = await (0, heic_convert_1.default)({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 0.8
        });
        return Buffer.from(outputBuffer);
    },
    async getZipEntries(filePath) {
        const zip = new adm_zip_1.default(filePath);
        return zip.getEntries()
            .filter(entry => !entry.isDirectory)
            .map(entry => ({
            name: entry.entryName,
            size: entry.header.size,
            compressedSize: entry.header.compressedSize,
            isDirectory: entry.isDirectory,
            path: entry.entryName,
            method: entry.header.method
        }));
    },
    async getZipEntryData(filePath, entryPath) {
        const zip = new adm_zip_1.default(filePath);
        const entry = zip.getEntry(entryPath);
        if (!entry || entry.isDirectory) {
            throw new Error('Entry not found or is a directory');
        }
        const buffer = entry.getData();
        const ext = path.extname(entry.entryName).toLowerCase();
        let contentType = 'application/octet-stream';
        if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml'].includes(ext))
            contentType = 'text/plain';
        if (['.jpg', '.jpeg'].includes(ext))
            contentType = 'image/jpeg';
        if (['.png'].includes(ext))
            contentType = 'image/png';
        if (['.pdf'].includes(ext))
            contentType = 'application/pdf';
        return { buffer, contentType };
    }
};
