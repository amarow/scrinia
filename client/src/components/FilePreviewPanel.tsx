import { Text, LoadingOverlay, Button, Group, Center, Table, Paper, Stack } from '@mantine/core';
import { useAppStore } from '../store';
import { useEffect, useState } from 'react';
import { IconExternalLink, IconFileUnknown, IconArrowLeft, IconFolder, IconShieldLock, IconEye } from '@tabler/icons-react';
import { FileViewer } from './FileViewer';
import { translations } from '../i18n';
import { authFetch, API_BASE } from '../store/utils';

export function FilePreviewPanel() {
    const { 
        previewFileId, setPreviewFileId, files, searchResults, 
        token, openFile, openDirectory, language,
        privacyProfiles, fetchPrivacyProfiles
    } = useAppStore();
    const t = translations[language];
    const [zipContent, setZipContent] = useState<any[] | null>(null);
    const [selectedZipEntry, setSelectedZipEntry] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportView, setExportView] = useState(false);
    const [redactedText, setRedactedText] = useState<string | null>(null);

    // Look up file in files list OR search results
    const file = files.find(f => f.id === previewFileId) || searchResults.find(f => f.id === previewFileId);

    useEffect(() => {
        if (privacyProfiles.length === 0 && token) {
            fetchPrivacyProfiles();
        }
    }, [token]);

    // Fetch redacted text when exportView is enabled
    useEffect(() => {
        if (exportView && file && token) {
            const profileId = privacyProfiles[0]?.id;
            if (!profileId) return;

            setLoading(true);
            authFetch(`${API_BASE}/api/files/${file.id}/text-content?profileId=${profileId}`, token)
                .then(res => res.text())
                .then(text => {
                    setRedactedText(text);
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        }
    }, [exportView, file, token, privacyProfiles]);

    // Handle Escape key to close preview
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedZipEntry) {
                    setSelectedZipEntry(null);
                } else {
                    setPreviewFileId(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setPreviewFileId, selectedZipEntry]);

    useEffect(() => {
        if (!file || !token) return;
        
        // Reset state on file change
        setZipContent(null);
        setSelectedZipEntry(null);
        setError(null);
        setLoading(false);

        const ext = file.extension.toLowerCase();
        const isZip = ['.zip', '.7z', '.rar', '.tar', '.gz'].includes(ext);
        
        if (isZip) {
            setLoading(true);
            fetch(`${API_BASE}/api/files/${file.id}/zip-content?token=${token}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load archive content");
                    return res.json();
                })
                .then(data => {
                    setZipContent(data);
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        }
    }, [file, token]);

    if (!file) return null;

    // Main file URL
    const fileUrl = `${API_BASE}/api/files/${file.id}/content?token=${token}`;
    const ext = file.extension.toLowerCase();
    const isZip = ['.zip', '.7z', '.rar', '.tar', '.gz'].includes(ext);

    // ZIP Entry Handling
    if (selectedZipEntry) {
        const entryUrl = `${API_BASE}/api/files/${file.id}/zip-entry?path=${encodeURIComponent(selectedZipEntry)}&token=${token}`;
        // Guess extension from entry path
        const entryExt = '.' + selectedZipEntry.split('.').pop() || '';
        const entryName = selectedZipEntry.split('/').pop() || selectedZipEntry;

        return (
            <Paper 
                style={{ 
                    height: 'calc(100vh - 100px)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden',
                    border: '1px solid var(--mantine-color-default-border)',
                    position: 'relative'
                }} 
                p="md" 
                shadow="xs"
            >
                {/* Header for Zip Entry */}
                <Group justify="space-between" mb="md" style={{ flexShrink: 0 }}>
                    <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        <Button 
                            variant="subtle" 
                            color="gray" 
                            leftSection={<IconArrowLeft size={20} />}
                            onClick={() => setSelectedZipEntry(null)}
                        >
                            {translations[language].back}
                        </Button>
                        <div style={{ minWidth: 0, borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: '1rem' }}>
                            <Text fw={700} size="lg" truncate>{entryName}</Text>
                            <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }} truncate>{selectedZipEntry}</Text>
                        </div>
                    </Group>
                </Group>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <FileViewer 
                        url={entryUrl} 
                        filename={entryName} 
                        extension={entryExt} 
                    />
                </div>
            </Paper>
        );
    }

    return (
        <Paper 
            style={{ 
                height: 'calc(100vh - 100px)', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden',
                border: '1px solid var(--mantine-color-default-border)',
                position: 'relative'
            }} 
            p="md" 
            shadow="xs"
        >
            {/* Header */}
            <Group justify="space-between" mb="md" style={{ flexShrink: 0 }}>
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <Button 
                        variant="subtle" 
                        color="gray" 
                        leftSection={<IconArrowLeft size={20} />}
                        onClick={() => setPreviewFileId(null)}
                    >
                        {translations[language].back}
                    </Button>
                    <div style={{ minWidth: 0, borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: '1rem' }}>
                        <Text fw={700} size="lg" truncate>{file.name}</Text>
                        <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }} truncate>{file.path}</Text>
                    </div>
                </Group>
                <Group>
                    <Button 
                        leftSection={exportView ? <IconEye size={16} /> : <IconShieldLock size={16} />} 
                        variant="light" 
                        size="xs"
                        color={exportView ? "blue" : "orange"}
                        onClick={() => {
                            setExportView(!exportView);
                            setRedactedText(null);
                        }}
                    >
                        {exportView ? t.standardPreview : t.exportPreview}
                    </Button>
                    <Button 
                        leftSection={<IconFolder size={16} />} 
                        variant="light" 
                        size="xs"
                        color="gray"
                        onClick={() => openDirectory(file.id)}
                    >
                        {t.openDirectory}
                    </Button>
                    <Button 
                        leftSection={<IconExternalLink size={16} />} 
                        variant="light" 
                        size="xs"
                        onClick={() => openFile(file.id)}
                    >
                        {t.openFile}
                    </Button>
                </Group>
            </Group>

            {/* Content Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <LoadingOverlay visible={loading} overlayProps={{ radius: "sm", blur: 2 }} />
                
                {error && (
                    <Center h="100%">
                        <Stack align="center">
                            <IconFileUnknown size={48} color="red" />
                            <Text c="red">Error loading preview</Text>
                            <Text size="sm" c="dimmed">{error}</Text>
                        </Stack>
                    </Center>
                )}

                {!loading && !error && (
                    <>
                        {exportView ? (
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {privacyProfiles.length > 0 ? (
                                    <Paper withBorder p="md" style={{ flex: 1, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px' }}>
                                        <Text size="xs" c="dimmed" mb="md" fw={700}>
                                            PROFIL: {privacyProfiles[0].name}
                                        </Text>
                                        {redactedText}
                                    </Paper>
                                ) : (
                                    <Center h="100%">
                                        <Text c="dimmed">{t.noPrivacyProfile}</Text>
                                    </Center>
                                )}
                            </div>
                        ) : isZip && zipContent ? (
                            <div style={{ overflow: 'auto', maxHeight: '100%' }}>
                                <Table striped highlightOnHover>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Name</Table.Th>
                                            <Table.Th>Size</Table.Th>
                                            <Table.Th>Compressed</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {zipContent.map((entry: any, i: number) => (
                                            <Table.Tr 
                                                key={i} 
                                                style={{ cursor: entry.isDirectory ? 'default' : 'pointer' }}
                                                onClick={() => !entry.isDirectory && setSelectedZipEntry(entry.path)}
                                            >
                                                <Table.Td>
                                                    <Group gap="xs">
                                                        <Text size="sm" fw={entry.isDirectory ? 700 : 400} c={entry.isDirectory ? 'dimmed' : undefined}>
                                                            {entry.name}
                                                        </Text>
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>{entry.isDirectory ? '-' : `${(entry.size / 1024).toFixed(1)} KB`}</Table.Td>
                                                <Table.Td>{entry.isDirectory ? '-' : `${(entry.compressedSize / 1024).toFixed(1)} KB`}</Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </div>
                        ) : (
                            // Standard File Viewer for non-zip or loading phase
                            <FileViewer 
                                url={fileUrl} 
                                filename={file.name} 
                                extension={ext} 
                                onOpenExternally={() => openFile(file.id)}
                            />
                        )}
                    </>
                )}
            </div>
        </Paper>
    );
}
