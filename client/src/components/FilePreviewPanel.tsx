import { Text, LoadingOverlay, Button, Group, Center, Table, Paper, Stack, Select, Badge, ActionIcon } from '@mantine/core';
import { useAppStore } from '../store';
import { useEffect, useState, useCallback } from 'react';
import { IconExternalLink, IconFileUnknown, IconArrowLeft, IconFolder, IconShieldLock, IconEye, IconPlus, IconCopy, IconX } from '@tabler/icons-react';
import { FileViewer } from './FileViewer';
import { translations } from '../i18n';
import { authFetch, API_BASE } from '../store/utils';
import React, { useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useDraggable } from '@dnd-kit/core';

const DraggableSelection = ({ text, children, disabled }: { text: string, children: React.ReactNode, disabled?: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: 'text-selection-draggable',
        data: { type: 'TEXT_SELECTION', text },
        disabled
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 9999,
        opacity: 0.8,
        cursor: 'grabbing'
    } : {
        cursor: disabled ? 'default' : 'grab'
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {children}
        </div>
    );
};

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
        privacyRefreshCounter, tags, fetchTags, activeMainTab
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
    const [selectionText, setSelectionText] = useState('');
    const [responseFormat, setResponseFormat] = useState<'text' | 'json'>('text');
    
    // Look up file in files list OR search results
    const file = files.find(f => f.id === previewFileId) || searchResults.find(f => f.id === previewFileId);

    // Generate dynamic URL for single file
    const getDynamicUrl = () => {
        if (!file) return '';
        const key = apiKeys.find(k => k.id.toString() === selectedApiKeyId)?.key || 'YOUR_KEY';
        return `${API_BASE}/api/v1/files/${file.id}/text?apiKey=${key}${responseFormat === 'json' ? '&format=json' : ''}`;
    };

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
        
        clearSelection();
    };

    const clearSelection = useCallback(() => {
        setHasSelection(false);
        setSelectionText('');
        (window as any)._currentScriniaSelection = '';
        window.getSelection()?.removeAllRanges();
    }, []);

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
        if (hasSel) {
            setSelectionText((window as any)._currentScriniaSelection || '');
        } else {
            setSelectionText('');
        }
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

    // Filter tags based on selected API Key permissions
    const getAvailableTagsForSelectedKey = () => {
        const apiKey = apiKeys.find(k => k.id.toString() === selectedApiKeyId);
        if (!apiKey) return [];
        
        // If 'all' permission is present, return all tags
        if (apiKey.permissions.includes('all')) {
            return tags.map(t => ({ value: t.name, label: t.name }));
        }

        // Filter tags by ID if permission like 'tag:ID' exists
        const allowedTagIds = apiKey.permissions
            .filter(p => p.startsWith('tag:'))
            .map(p => parseInt(p.split(':')[1]));

        return tags
            .filter(t => allowedTagIds.includes(t.id))
            .map(t => ({ value: t.name, label: t.name }));
    };

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
                    {activeMainTab !== 'filter' && (
                        <Button.Group>
                            <Button 
                                variant={viewMode === 'standard' ? "filled" : "default"} 
                                size="xs"
                                onClick={() => setViewMode('standard')}
                            >
                                {t.standardPreview}
                            </Button>
                            <Button 
                                variant={viewMode === 'editor' ? "filled" : "default"} 
                                size="xs"
                                onClick={() => {
                                    setViewMode('editor');
                                    setRedactedText(null);
                                }}
                            >
                                {t.rulesView || 'Rules View'}
                            </Button>
                            <Button 
                                variant={viewMode === 'preview' ? "filled" : "default"} 
                                size="xs"
                                onClick={() => {
                                    setViewMode('preview');
                                    setRedactedText(null);
                                }}
                            >
                                {t.exportPreview}
                            </Button>
                        </Button.Group>
                    )}

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
                                                                                                        <DraggableSelection 
                                                                                                            text={selectionText} 
                                                                                                            disabled={!hasSelection}
                                                                                                        >
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
                                                                                                        </DraggableSelection>
                                                                                                    </>
                                            ) : (
                                                <Group gap="xs" align="flex-end" wrap="nowrap" style={{ flex: 1 }}>
                                                    <Select
                                                        label="API Key"
                                                        size="xs"
                                                        placeholder={t.apiKey}
                                                        data={apiKeys.map(k => ({ value: k.id.toString(), label: k.name }))}
                                                        value={selectedApiKeyId}
                                                        onChange={setSelectedApiKeyId}
                                                        style={{ width: 180, flexShrink: 0 }}
                                                    />
                                                    <Select
                                                        label="Format"
                                                        size="xs"
                                                        data={[
                                                            { value: 'text', label: 'Text' },
                                                            { value: 'json', label: 'JSON' }
                                                        ]}
                                                        value={responseFormat}
                                                        onChange={(val) => setResponseFormat(val as any)}
                                                        style={{ width: 80, flexShrink: 0 }}
                                                    />
                                                    <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
                                                        <Text size="xs" fw={500} c="dimmed">Export URL</Text>
                                                        <Paper withBorder p="4px 8px" bg="var(--mantine-color-dark-8)" style={{ borderRadius: '4px' }}>
                                                            <Group gap="xs" wrap="nowrap">
                                                                <Text size="xs" c="blue" fw={700} style={{ flexShrink: 0 }}>GET</Text>
                                                                <Text 
                                                                    size="xs" 
                                                                    component="a" 
                                                                    href={getDynamicUrl()}
                                                                    target="_blank"
                                                                    style={{ wordBreak: 'break-all', fontFamily: 'monospace', textDecoration: 'none', color: 'inherit', cursor: 'pointer', flex: 1 }}
                                                                >
                                                                    {getDynamicUrl()}
                                                                </Text>
                                                                <ActionIcon 
                                                                    size="xs" 
                                                                    variant="subtle" 
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(getDynamicUrl());
                                                                        notifications.show({ message: 'URL copied to clipboard', color: 'blue', size: 'xs' });
                                                                    }}
                                                                >
                                                                    <IconCopy size={14} />
                                                                </ActionIcon>
                                                            </Group>
                                                        </Paper>
                                                    </Stack>
                                                </Group>
                                            )}
                                        </Group>
                                    </Stack>
                                    <RedactedContent 
                                        html={redactedText || ''} 
                                        onSelectionChange={handleSelectionChange}
                                        onRedactedClick={handleRedactedClick}
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
