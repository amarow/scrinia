import { Modal, Image, Text, LoadingOverlay, Button, Group, ScrollArea, Center, Code, Table } from '@mantine/core';
import { useAppStore } from '../store';
import { useEffect, useState } from 'react';
import { IconExternalLink, IconFileUnknown } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import Papa from 'papaparse';

export function FilePreviewModal() {
    const { previewFileId, setPreviewFileId, files, searchResults, token, openFile } = useAppStore();
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Look up file in files list OR search results
    const file = files.find(f => f.id === previewFileId) || searchResults.find(f => f.id === previewFileId);

    const API_BASE = 'http://localhost:3001';

    useEffect(() => {
        if (!file || !token) return;
        
        const ext = file.extension.toLowerCase();
        const isText = [
            '.txt', '.md', '.json', '.ts', '.js', '.jsx', '.tsx', '.css', '.scss', '.html', '.xml', '.yaml', '.yml', '.sql', '.env', '.log', '.sh', '.py',
            '.rs', '.go', '.c', '.cpp', '.h', '.java', '.kt', '.rb', '.php', '.pl', '.lua', '.toml', '.ini', '.conf', '.dockerfile', '.csv'
        ].includes(ext);
        
        if (isText) {
            setLoading(true);
            setError(null);
            fetch(`${API_BASE}/api/files/${file.id}/content?token=${token}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load content");
                    return res.text();
                })
                .then(text => {
                    // Limit text size for performance
                    if (text.length > 50000) {
                        setTextContent(text.substring(0, 50000) + "\n\n... (Content truncated for preview) ...");
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
    }, [file, token]);

    if (!file) return null;

    const fileUrl = `${API_BASE}/api/files/${file.id}/content?token=${token}`;
    const ext = file.extension.toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'].includes(ext);
    const isPdf = ext === '.pdf';
    const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext);
    const isVideo = ['.mp4', '.webm', '.ogg', '.mov'].includes(ext);
    const isMarkdown = ['.md', '.markdown'].includes(ext);
    const isCsv = ['.csv'].includes(ext);
    const isJson = ['.json'].includes(ext);
    const isText = textContent !== null;

    let parsedCsv: any[] = [];
    if (isCsv && textContent) {
        parsedCsv = Papa.parse(textContent, { header: true, skipEmptyLines: true }).data;
    }

    let formattedJson = textContent;
    if (isJson && textContent) {
        try {
            formattedJson = JSON.stringify(JSON.parse(textContent), null, 2);
        } catch (e) {
            // Keep original text on error
        }
    }

    return (
        <Modal 
            opened={!!previewFileId} 
            onClose={() => setPreviewFileId(null)} 
            title={
                <Group justify="space-between" style={{ width: '100%' }} wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={700} size="lg" truncate>{file.name}</Text>
                        <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>{file.path}</Text>
                    </div>
                    <Button 
                        leftSection={<IconExternalLink size={16} />} 
                        variant="light" 
                        size="sm"
                        onClick={() => {
                            openFile(file.id);
                            setPreviewFileId(null);
                        }}
                        style={{ flexShrink: 0, marginLeft: '1rem' }}
                    >
                        Open in System
                    </Button>
                </Group>
            }
            size="95vw"
            padding="md"
            styles={{ 
                content: { maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
                body: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: '60vw', maxWidth: '95vw', overflow: 'hidden', minHeight: '80vh' },
                header: { width: '100%', flexShrink: 0 },
                title: { flex: 1 }
            }}
        >
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <LoadingOverlay visible={loading} overlayProps={{ radius: "sm", blur: 2 }} />
                
                {error && (
                    <Center h="100%">
                        <Text c="red">Error loading preview: {error}</Text>
                    </Center>
                )}

                {!loading && !error && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        {isImage && (
                            <Center h="100%" style={{ overflow: 'auto' }}>
                                <Image src={fileUrl} fit="contain" style={{ maxHeight: '100%', maxWidth: '100%' }} />
                            </Center>
                        )}

                        {isPdf && (
                            <div style={{ flex: '1 1 0', minHeight: 0 }}>
                                <iframe 
                                    src={fileUrl} 
                                    style={{ width: '100%', height: '100%', border: 'none' }} 
                                    title="PDF Preview"
                                />
                            </div>
                        )}

                        {isAudio && (
                            <Center h="100%" style={{ flexDirection: 'column', gap: 16 }}>
                                <IconFileUnknown size={48} color="gray" /> {/* Using generic icon as placeholder */}
                                <Text size="lg">{file.name}</Text>
                                <audio controls autoPlay src={fileUrl} style={{ width: '80%' }}>
                                    Your browser does not support the audio element.
                                </audio>
                            </Center>
                        )}

                        {isVideo && (
                            <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <video 
                                    controls 
                                    autoPlay 
                                    src={fileUrl} 
                                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                                >
                                    Your browser does not support the audio element.
                                </video>
                            </div>
                        )}

                        {isText && (
                            <div style={{ flex: 1, overflow: 'auto', width: '100%' }}>
                                <div style={{ padding: '4px' }}>
                                    {isMarkdown ? (
                                        <div style={{ padding: '1rem' }}>
                                            <ReactMarkdown>{textContent}</ReactMarkdown>
                                        </div>
                                    ) : isCsv ? (
                                        <Table striped highlightOnHover withTableBorder withColumnBorders>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    {parsedCsv.length > 0 && Object.keys(parsedCsv[0]).map((key) => (
                                                        <Table.Th key={key}>{key}</Table.Th>
                                                    ))}
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {parsedCsv.map((row, i) => (
                                                    <Table.Tr key={i}>
                                                        {Object.values(row).map((val: any, j) => (
                                                            <Table.Td key={j}>{val}</Table.Td>
                                                        ))}
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    ) : isJson ? (
                                        <Code block style={{ whiteSpace: 'pre-wrap' }}>
                                            {formattedJson}
                                        </Code>
                                    ) : (
                                        <Code block style={{ whiteSpace: 'pre-wrap' }}>
                                            {textContent}
                                        </Code>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isImage && !isPdf && !isText && !isAudio && !isVideo && (
                            <Center h="100%" style={{ flexDirection: 'column', gap: 16 }}>
                                <IconFileUnknown size={64} color="gray" />
                                <Text c="dimmed">No preview available for this file type.</Text>
                                <Button onClick={() => openFile(file.id)}>Open Externally</Button>
                            </Center>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
