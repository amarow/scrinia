import * as fs from 'fs/promises';
import * as fsNative from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import heicConvert from 'heic-convert';
import mammoth from 'mammoth';
const pdf = require('pdf-parse');

export const fileService = {
    calculateHash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fsNative.createReadStream(filePath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => reject(err));
        });
    },

    async extractText(filePath: string, extension: string): Promise<string> {
        const ext = extension.toLowerCase();
        
        try {
            // Check size first (limit to 20MB for text extraction)
            const stats = await fs.stat(filePath);
            const maxSize = (ext === '.pdf' || ext === '.docx' || ext === '.odt') ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
            
            if (stats.size > maxSize) return "";

            if (ext === '.pdf') {
                const dataBuffer = await fs.readFile(filePath);

                // Suppress annoying console warnings from pdf-parse/pdf.js (e.g. "Warning: TT: undefined function: 32")
                const originalLog = console.log;
                const originalWarn = console.warn;
                
                const suppress = (...args: any[]) => {
                    const msg = args.join(' ');
                    if (msg.includes('Warning: TT: undefined function: 32')) return;
                    originalLog.apply(console, args);
                };
                
                console.log = suppress;
                console.warn = suppress;

                try {
                    const data = await pdf(dataBuffer);
                    return data.text;
                } finally {
                    console.log = originalLog;
                    console.warn = originalWarn;
                }
            }

            if (ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                return result.value;
            } 
            
            if (ext === '.odt') {
                const zip = new AdmZip(filePath);
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

            // Default: Read as plain text for known text extensions
            const textExtensions = ['.txt', '.md', '.markdown', '.json', '.ts', '.js', '.jsx', '.tsx', '.html', '.css', '.scss', '.xml', '.yaml', '.yml', '.sql', '.env'];
            if (textExtensions.includes(ext)) {
                 return await fs.readFile(filePath, 'utf8');
            }
            return "";
        } catch (e) {
            console.error(`Error extracting text from ${filePath}:`, e);
            return "";
        }
    },

    async convertHeicToJpeg(filePath: string): Promise<Buffer> {
        const inputBuffer = await fs.readFile(filePath);
        const outputBuffer = await heicConvert({
            buffer: inputBuffer as any,
            format: 'JPEG',
            quality: 0.8
        });
        return Buffer.from(outputBuffer);
    },

    async getZipEntries(filePath: string) {
        const zip = new AdmZip(filePath);
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

    async getZipEntryData(filePath: string, entryPath: string): Promise<{ buffer: Buffer, contentType: string }> {
        const zip = new AdmZip(filePath);
        const entry = zip.getEntry(entryPath);

        if (!entry || entry.isDirectory) {
            throw new Error('Entry not found or is a directory');
        }

        const buffer = entry.getData();
        const ext = path.extname(entry.entryName).toLowerCase();
        
        let contentType = 'application/octet-stream';
        if (['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml'].includes(ext)) contentType = 'text/plain';
        if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
        if (['.png'].includes(ext)) contentType = 'image/png';
        if (['.pdf'].includes(ext)) contentType = 'application/pdf';

        return { buffer, contentType };
    }
};
