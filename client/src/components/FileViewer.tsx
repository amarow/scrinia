import { Image, Text, LoadingOverlay, Button, Center, Table, Stack } from '@mantine/core';
import { IconFileUnknown } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Papa from 'papaparse';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileViewerProps {
    url: string;
    filename: string;
    extension: string;
    onOpenExternally?: () => void;
}

const getLanguage = (ext: string) => {
    const map: Record<string, string> = {
        '.js': 'javascript', '.jsx': 'jsx', '.ts': 'typescript', '.tsx': 'tsx',
        '.css': 'css', '.scss': 'scss', '.html': 'html', '.xml': 'xml',
        '.json': 'json', '.sql': 'sql', '.py': 'python', '.java': 'java',
        '.c': 'c', '.cpp': 'cpp', '.h': 'cpp', '.rs': 'rust', '.go': 'go',
        '.php': 'php', '.rb': 'ruby', '.sh': 'bash', '.yaml': 'yaml', '.yml': 'yaml',
        '.md': 'markdown', '.dockerfile': 'dockerfile'
    };
    return map[ext] || 'text';
};

export function FileViewer({ url, filename, extension, onOpenExternally }: FileViewerProps) {
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ext = extension.toLowerCase();
    
    // Expanded list of text-like files
    const isText = [
        '.txt', '.md', '.json', '.ts', '.js', '.jsx', '.tsx', '.css', '.scss', '.html', '.xml', '.yaml', '.yml', '.sql', '.env', '.log', '.sh', '.py',
        '.rs', '.go', '.c', '.cpp', '.h', '.java', '.kt', '.rb', '.php', '.pl', '.lua', '.toml', '.ini', '.conf', '.dockerfile', '.csv', '.svg'
    ].includes(ext);

    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic'].includes(ext);
    const isPdf = ext === '.pdf';
    const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext);
    const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].includes(ext);
    const isMarkdown = ['.md', '.markdown'].includes(ext);
    const isCsv = ['.csv'].includes(ext);
    const isJson = ['.json'].includes(ext);

    useEffect(() => {
        if (isText) {
            setLoading(true);
            setError(null);
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load content");
                    return res.text();
                })
                .then(text => {
                    if (text.length > 100000) {
                        setTextContent(text.substring(0, 100000) + `

... (Content truncated for preview) ...`);
                    } else {
                        setTextContent(text);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        } else {
            setTextContent(null);
            setLoading(false);
            setError(null);
        }
    }, [url, isText]);

    // Helper for CSV parsing
    let parsedCsv: any[] = [];
    let csvColumns: string[] = [];
    if (isCsv && textContent) {
        const result = Papa.parse(textContent, { header: true, skipEmptyLines: true });
        parsedCsv = result.data;
        csvColumns = result.meta.fields || [];
    }

    // Helper for JSON formatting
    let formattedJson = textContent;
    if (isJson && textContent) {
        try {
            formattedJson = JSON.stringify(JSON.parse(textContent), null, 2);
        } catch (e) {
            // Keep original text on error
        }
    }

    if (loading) return <LoadingOverlay visible={true} overlayProps={{ radius: "sm", blur: 2 }} />;
    
    if (error) return (
        <Center h="100%">
            <Stack align="center">
                <IconFileUnknown size={48} color="red" />
                <Text c="red">Error loading preview</Text>
                <Text size="sm" c="dimmed">{error}</Text>
            </Stack>
        </Center>
    );

    const language = getLanguage(ext);
    const displayContent = isJson ? formattedJson : textContent;

    return (
        <div style={{ flex: 1, overflow: 'auto', height: '100%' }}>
            {isImage && (
                <Center h="100%" style={{ minHeight: '300px' }}>
                    <Image src={url} fit="contain" style={{ maxHeight: '100%', maxWidth: '100%' }} />
                </Center>
            )}

            {isPdf && (
                <iframe 
                    src={url} 
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} 
                    title="PDF Preview"
                />
            )}

            {isAudio && (
                <Center h="100%" style={{ flexDirection: 'column', gap: 16 }}>
                    <IconFileUnknown size={64} color="gray" />
                    <Text size="lg">{filename}</Text>
                    <audio controls autoPlay src={url} style={{ width: '80%' }}>
                        Your browser does not support the audio element.
                    </audio>
                </Center>
            )}

            {isVideo && (
                <Center h="100%">
                    <video 
                        controls 
                        autoPlay 
                        src={url} 
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                    >
                        Your browser does not support the video element.
                    </video>
                </Center>
            )}

            {textContent !== null && !isPdf && (
                <div style={{ padding: '0.5rem', height: '100%' }}>
                    {isMarkdown ? (
                        <div className="markdown-body" style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <ReactMarkdown>{textContent || ''}</ReactMarkdown>
                        </div>
                    ) : isCsv ? (
                        <div style={{ overflow: 'auto', maxHeight: '100%' }}>
                            <Table striped highlightOnHover withTableBorder withColumnBorders>
                                <Table.Thead>
                                    <Table.Tr>
                                        {csvColumns.map((key) => (
                                            <Table.Th key={key} style={{ whiteSpace: 'nowrap' }}>{key}</Table.Th>
                                        ))}
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {parsedCsv.map((row: any, i) => (
                                        <Table.Tr key={i}>
                                            {csvColumns.map((col) => (
                                                <Table.Td key={col} style={{ whiteSpace: 'nowrap' }}>{row[col]}</Table.Td>
                                            ))}
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </div>
                    ) : (
                        <SyntaxHighlighter 
                            language={language} 
                            style={vscDarkPlus}
                            customStyle={{ margin: 0, height: '100%', fontSize: '0.85rem' }}
                            showLineNumbers={true}
                        >
                            {displayContent || ''}
                        </SyntaxHighlighter>
                    )}
                </div>
            )}

            {!isImage && !isPdf && textContent === null && !isAudio && !isVideo && (
                <Center h="100%" style={{ flexDirection: 'column', gap: 16 }}>
                    <IconFileUnknown size={64} color="gray" />
                    <Text c="dimmed">No preview available for this file type.</Text>
                    {onOpenExternally && <Button onClick={onOpenExternally}>Open Externally</Button>}
                </Center>
            )}
        </div>
    );
}
