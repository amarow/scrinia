import { Text, LoadingOverlay, Button, Group, Center, Table, Paper, Stack, Select, Badge, ActionIcon } from '@mantine/core';
import { useAppStore } from '../store';
import { useEffect, useState, useCallback } from 'react';
import { IconExternalLink, IconFileUnknown, IconArrowLeft, IconFolder, IconShieldLock, IconEye, IconPlus, IconCopy } from '@tabler/icons-react';
import { FileViewer } from './FileViewer';
import { translations } from '../i18n';
import { authFetch, API_BASE } from '../store/utils';
import React, { useRef } from 'react';
import { notifications } from '@mantine/notifications';

// Memoized sub-component to prevent re-renders of the HTML content which would lose selection
const RedactedContent = React.memo(({ html, onSelectionChange, onRedactedClick }: { 
    html: string, 
    onSelectionChange: (hasSel: boolean) => void,
    onRedactedClick: (ruleId: number, profileId: number) => void 
}) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        
        const handleMouseUp = () => {
            const selection = window.getSelection();
            const text = selection ? selection.toString().trim() : '';
            if (text) {
                (window as any)._currentScriniaSelection = text;
                onSelectionChange(true);
            } else {
                onSelectionChange(false);
            }
        };

        node.addEventListener('mouseup', handleMouseUp);
        return () => node.removeEventListener('mouseup', handleMouseUp);
    }, [onSelectionChange]);

    const handleClick = (e: React.MouseEvent) => {
        if (window.getSelection()?.toString().trim()) return;
        const target = e.target as HTMLElement;
        const span = target.closest('.redacted-text') as HTMLElement;
        if (span) {
            const ruleId = span.getAttribute('data-rule-id');
            const profileId = span.getAttribute('data-profile-id');
            if (ruleId && profileId) {
                onRedactedClick(parseInt(ruleId), parseInt(profileId));
            }
        }
    };

    return (
        <>
            <div 
                ref={ref}
                style={{ cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text', position: 'relative' }}
                className="selectable-content"
                onClick={handleClick}
                dangerouslySetInnerHTML={{ __html: html }} 
            />
            <style>{`
                .selectable-content::selection { background: rgba(34, 139, 230, 0.3); }
                .selectable-content span::selection { background: rgba(34, 139, 230, 0.3); }
            `}</style>
        </>
    );
}, (prev, next) => prev.html === next.html);

export function FilePreviewPanel() {
    const { 
        previewFileId, setPreviewFileId, files, searchResults, 
        token, openFile, openDirectory, language,
        privacyProfiles, fetchPrivacyProfiles, apiKeys, fetchApiKeys,
        setEditingRule, fetchPrivacyRules, setIsPrivacyModalOpen,
        privacyRefreshCounter
    } = useAppStore();
    const t = translations[language];
    const [zipContent, setZipContent] = useState<any[] | null>(null);
    const [selectedZipEntry, setSelectedZipEntry] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'standard' | 'editor' | 'preview'>('standard');
    const [redactedText, setRedactedText] = useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);
    const [hasSelection, setHasSelection] = useState(false);

    // Look up file in files list OR search results
    const file = files.find(f => f.id === previewFileId) || searchResults.find(f => f.id === previewFileId);

    // Set defaults
    useEffect(() => {
        if (privacyProfiles.length > 0 && !selectedProfileId) {
            setSelectedProfileId(privacyProfiles[0].id.toString());
        }
        if (apiKeys.length > 0 && !selectedApiKeyId) {
            setSelectedApiKeyId(apiKeys[0].id.toString());
        }
    }, [privacyProfiles, apiKeys]);

    const handleAddRuleFromSelection = async () => {
        const currentSelection = (window as any)._currentScriniaSelection;
        
        if (!currentSelection || !selectedProfileId) return;
        
        const profileId = parseInt(selectedProfileId);
        const profile = privacyProfiles.find(p => p.id === profileId);
        
        if (!profile) return;

        const existingRules = await fetchPrivacyRules(profileId);
        const newRule = {
            type: 'LITERAL' as const,
            pattern: currentSelection,
            replacement: '[REDACTED]',
            isActive: true,
            tempId: Date.now()
        };

        setEditingRule({
            profileId,
            initialRules: [...existingRules, newRule],
            initialName: profile.name
        });
        setIsPrivacyModalOpen(true);
        
        setHasSelection(false);
        (window as any)._currentScriniaSelection = '';
        window.getSelection()?.removeAllRanges();
    };

    const fetchRedactedText = useCallback(() => {
        if (viewMode === 'standard' || !file || !token) return;

        setLoading(true);
        let url = `${API_BASE}/api/v1/files/${file.id}/text?format=html`;

        if (viewMode === 'editor' && selectedProfileId) {
            url += `&profileId=${selectedProfileId}`;
        } else if (viewMode === 'preview' && selectedApiKeyId) {
            const apiKey = apiKeys.find(k => k.id.toString() === selectedApiKeyId);
            if (apiKey && apiKey.privacyProfileIds?.length > 0) {
                url += `&${apiKey.privacyProfileIds.map(id => `profileId=${id}`).join('&')}`;
            }
        }

        authFetch(url, token)
            .then(async res => {
                if (res.status === 403) return 'ACCESS DENIED';
                return res.text();
            })
            .then(text => {
                setRedactedText(text);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [viewMode, file, token, selectedProfileId, selectedApiKeyId, apiKeys]);

    const handleRedactedClick = useCallback((ruleId: number, profileId: number) => {
        setEditingRule({ ruleId, profileId });
        setIsPrivacyModalOpen(true);
    }, [setEditingRule, setIsPrivacyModalOpen]);

    const handleSelectionChange = useCallback((hasSel: boolean) => {
        setHasSelection(hasSel);
    }, []);

    useEffect(() => {
        if (token) {
            if (privacyProfiles.length === 0) fetchPrivacyProfiles();
            if (apiKeys.length === 0) fetchApiKeys();
        }
    }, [token]);

    // Fetch redacted text when viewMode, profile, API Key or refresh counter changes
    useEffect(() => {
        fetchRedactedText();
    }, [fetchRedactedText, privacyRefreshCounter, selectedProfileId, selectedApiKeyId, viewMode]);

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
                    <Group gap={5}>
                        <Button 
                            variant={viewMode === 'standard' ? "filled" : "subtle"} 
                            size="xs"
                            color={viewMode === 'standard' ? "blue" : "gray"}
                            onClick={() => setViewMode('standard')}
                        >
                            Standard
                        </Button>
                        <Button 
                            variant={viewMode === 'editor' ? "filled" : "subtle"} 
                            size="xs"
                            color={viewMode === 'editor' ? "blue" : "gray"}
                            onClick={() => {
                                setViewMode('editor');
                                setRedactedText(null);
                            }}
                        >
                            Rule Editor
                        </Button>
                        <Button 
                            variant={viewMode === 'preview' ? "filled" : "subtle"} 
                            size="xs"
                            color={viewMode === 'preview' ? "blue" : "gray"}
                            onClick={() => {
                                setViewMode('preview');
                                setRedactedText(null);
                            }}
                        >
                            Export Preview
                        </Button>
                    </Group>

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
                        {viewMode !== 'standard' ? (
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <Paper withBorder p="md" style={{ flex: 1, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px' }}>
                                    <Stack gap="sm" mb="md">
                                        <Group align="flex-end" gap="md">
                                            {viewMode === 'editor' ? (
                                                <>
                                                    <Select
                                                        label="Rule Set"
                                                        size="xs"
                                                        placeholder="Select rule set..."
                                                        data={privacyProfiles.map(p => ({ value: p.id.toString(), label: p.name }))}
                                                        value={selectedProfileId}
                                                        onChange={setSelectedProfileId}
                                                        style={{ width: 250 }}
                                                    />
                                                    <Button
                                                        leftSection={<IconPlus size={16} />}
                                                        variant="filled"
                                                        size="xs"
                                                        color="blue"
                                                        disabled={!hasSelection}
                                                        onClick={handleAddRuleFromSelection}
                                                        style={{ marginBottom: '2px' }}
                                                    >
                                                        {t.add} Rule
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Select
                                                        label="API Key"
                                                        size="xs"
                                                        placeholder={t.apiKey}
                                                        data={apiKeys.map(k => ({ value: k.id.toString(), label: k.name }))}
                                                        value={selectedApiKeyId}
                                                        onChange={setSelectedApiKeyId}
                                                        style={{ width: 250 }}
                                                    />
                                                    <Paper withBorder p="4px 8px" bg="var(--mantine-color-dark-8)" style={{ borderRadius: '4px', flex: 1, marginBottom: '2px' }}>
                                                        <Group gap="xs" wrap="nowrap">
                                                            <Text size="xs" c="blue" fw={700} style={{ flexShrink: 0 }}>GET</Text>
                                                            <Text 
                                                                size="xs" 
                                                                component="a" 
                                                                href={`${window.location.origin}/api/v1/files/${file.id}/text?apiKey=${apiKeys.find(k => k.id.toString() === selectedApiKeyId)?.key || 'YOUR_KEY'}`}
                                                                target="_blank"
                                                                style={{ wordBreak: 'break-all', fontFamily: 'monospace', textDecoration: 'none', color: 'inherit', cursor: 'pointer', flex: 1 }}
                                                            >
                                                                {`${window.location.origin}/api/v1/files/${file.id}/text?apiKey=...`}
                                                            </Text>
                                                            <ActionIcon 
                                                                size="xs" 
                                                                variant="subtle" 
                                                                onClick={() => {
                                                                    const url = `${window.location.origin}/api/v1/files/${file.id}/text?apiKey=${apiKeys.find(k => k.id.toString() === selectedApiKeyId)?.key || ''}`;
                                                                    navigator.clipboard.writeText(url);
                                                                    notifications.show({ message: 'URL copied to clipboard', color: 'blue', size: 'xs' });
                                                                }}
                                                            >
                                                                <IconCopy size={14} />
                                                            </ActionIcon>
                                                        </Group>
                                                    </Paper>
                                                </>
                                            )}
                                        </Group>
                                    </Stack>
                                    <RedactedContent 
                                        html={redactedText || ''} 
                                        onSelectionChange={handleSelectionChange}
                                        onRedactedClick={viewMode === 'editor' ? handleRedactedClick : () => {}}
                                    />
                                </Paper>
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
