import { useState, useEffect, useCallback } from 'react';
import { Group, Stack, Text, Button, ActionIcon, TextInput, Paper, Divider, Badge, Select, LoadingOverlay, SegmentedControl, Switch, Input } from '@mantine/core';
import { IconKey, IconCheck, IconCopy, IconShieldLock, IconSearch, IconEye, IconExternalLink, IconX, IconTrash, IconCloudCheck, IconCloudX, IconCloudUpload } from '@tabler/icons-react';
import { useAppStore } from '../store';
import { translations } from '../i18n';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { authFetch, API_BASE } from '../store/utils';
import { useDroppable } from '@dnd-kit/core';

import { useNavigate } from 'react-router-dom';

export const ShareDetail = ({ shareId }: { shareId: number }) => {
  const navigate = useNavigate();
  const { 
    shares, updateShare, deleteShare, syncShare, tags, privacyProfiles, language, isLoading, token
  } = useAppStore();
  const t = translations[language];

  const { setNodeRef, isOver } = useDroppable({
    id: `share-detail-${shareId}`,
    data: { type: 'SHARE_TARGET', id: shareId }
  });

  const [name, setName] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [cloudSync, setCloudSync] = useState(false);
  
  // Batch/Context Builder states
  const [batchTag, setBatchTag] = useState<string | null>(null);
  const [batchQuery, setBatchQuery] = useState('');
  const [batchLimit, setBatchLimit] = useState<number>(50);
  const [responseFormat, setResponseFormat] = useState<'text' | 'json'>('text');
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const share = shares.find(k => k.id === shareId);

  useEffect(() => {
    if (share) {
      setName(share.name);
      setSelectedTags(share.tagIds ? share.tagIds.map(String) : []);
      setSelectedProfiles(share.privacyProfileIds ? share.privacyProfileIds.map(String) : []);
      setCloudSync(share.cloudSync || false);
    }
  }, [shareId, shares]);

  // Trigger preview automatically when format changes or key changes
  useEffect(() => {
    if (share) {
        handleFetchPreview();
    }
  }, [shareId, responseFormat]);

  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const span = target.closest('.redacted-text') as HTMLElement;
    if (span) {
        const ruleId = span.getAttribute('data-rule-id');
        const profileId = span.getAttribute('data-profile-id');
        if (profileId) {
            navigate(`/data/ruleset/${profileId}?ruleId=${ruleId}`);
        }
    }
  };

  const handleSave = async () => {
    const tagIds = selectedTags.map(id => parseInt(id));
    const profileIds = selectedProfiles.map(id => parseInt(id));
    
    await updateShare(shareId, { 
        name, 
        tagIds, 
        privacyProfileIds: profileIds,
        cloudSync
    });

    handleFetchPreview();
    
    notifications.show({
        title: t.save,
        message: 'Share updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />
    });
  };

  const handleDelete = () => {
    modals.openConfirmModal({
        title: t.deleteKeyTitle,
        children: <Text size="sm">{t.areYouSure}</Text>,
        labels: { confirm: t.delete, cancel: t.cancel },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
            await deleteShare(shareId);
            navigate('/data');
        },
    });
  };

  const getDynamicUrl = (useOverrides = false) => {
    if (!share) return '';
    let endpoint = responseFormat === 'json' ? 'json' : 'text';
    let url = `${API_BASE}/api/v1/files/${endpoint}?apiKey=${share.key}&limit=${batchLimit}`;
    if (batchTag) url += `&tag=${encodeURIComponent(batchTag)}`;
    if (batchQuery) url += `&q=${encodeURIComponent(batchQuery)}`;
    
    if (useOverrides) {
        if (selectedTags.length > 0) url += `&overrideTags=${selectedTags.join(',')}`;
        if (selectedProfiles.length > 0) url += `&overrideProfiles=${selectedProfiles.join(',')}`;
    }
    
    return url;
  };

  const handleFetchPreview = async () => {
    if (!share || !token) return;
    setPreviewLoading(true);
    setPreviewCount(null);
    try {
        let previewUrl = getDynamicUrl(true) + '&format=html';

        const res = await authFetch(previewUrl, token);
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }

        const countHeader = res.headers.get('X-File-Count');
        if (countHeader) {
            setPreviewCount(parseInt(countHeader));
        }
        
        if (responseFormat === 'json') {
            const data = await res.json();
            setPreviewContent(JSON.stringify(data, null, 2));
        } else {
            const text = await res.text();
            setPreviewContent(text);
        }
    } catch (err: any) {
        setPreviewContent(`Error: ${err.message}`);
    } finally {
        setPreviewLoading(false);
    }
  };

  const getAvailableTags = () => {
    if (!share) return [];
    return tags
        .filter(t => selectedTags.includes(t.id.toString()))
        .map(t => ({ value: t.name, label: t.name }));
  };

  if (!share) return <Text>Share not found</Text>;

  return (
    <Stack gap="md" style={{ height: '100%', minHeight: 0 }}>
        <Paper 
            withBorder 
            p="xs" 
            radius="md" 
            style={{ 
                position: 'relative',
                transition: 'background-color 0.2s ease', 
                flexShrink: 0,
                backgroundColor: isOver ? 'var(--mantine-color-blue-light)' : undefined,
                borderColor: isOver ? 'var(--mantine-color-blue-filled)' : undefined
            }}
        >
            {/* DND Overlay - catches drops without blocking inputs when not dragging */}
            <div 
                ref={setNodeRef}
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: isOver ? 10 : -1, // Only come to front when something is being dragged over or needed? 
                    // Actually, better: always front but pointer-events none unless dragging.
                    // But we want to catch the 'over' event.
                }}
            />

            <Group justify="space-between" align="flex-end" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
                <Group align="flex-end" gap="lg" style={{ flex: 1 }}>
                    <IconKey size={32} color="var(--mantine-color-blue-filled)" style={{ marginBottom: 4 }} />
                    
                    <TextInput 
                        label={t.keyName}
                        size="sm"
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                        style={{ width: 180 }}
                    />

                    <TextInput 
                        label="Token"
                        size="sm"
                        value={share.key}
                        readOnly
                        rightSection={
                            <ActionIcon 
                                variant="subtle" 
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(share.key || '');
                                    notifications.show({ message: t.copied, color: 'green', icon: <IconCheck size={14} /> });
                                }}
                            >
                                <IconCopy size={14} />
                            </ActionIcon>
                        }
                        styles={{ input: { fontFamily: 'monospace', fontSize: '11px', width: 140 } }}
                    />

                    <Input.Wrapper label={t.cloudSync}>
                        <div style={{ height: 36, display: 'flex', alignItems: 'center' }}>
                            <Switch 
                                size="md"
                                checked={cloudSync}
                                onChange={(e) => setCloudSync(e.currentTarget.checked)}
                                thumbIcon={cloudSync ? <IconCloudCheck size={14} /> : <IconCloudX size={14} />}
                            />
                        </div>
                    </Input.Wrapper>

                    <Input.Wrapper label={t.tags} style={{ flex: 1, minWidth: 220 }}>
                        <Group gap={6} style={{ minHeight: 36, alignItems: 'center' }}>
                            {selectedTags.length > 0 ? selectedTags.map(id => {
                                const tag = tags.find(t => t.id.toString() === id);
                                return tag ? (
                                    <Badge 
                                        key={id} 
                                        variant="light" 
                                        size="lg" 
                                        color={tag.color || 'blue'}
                                        rightSection={
                                            <ActionIcon size="xs" variant="transparent" color="gray" onClick={() => {
                                                setSelectedTags(prev => prev.filter(tId => tId !== id));
                                            }}>
                                                <IconX size={12} />
                                            </ActionIcon>
                                        }
                                    >
                                        {tag.name}
                                    </Badge>
                                ) : null;
                            }) : <Text size="xs" c="dimmed" fs="italic">Drag tags here</Text>}
                        </Group>
                    </Input.Wrapper>

                    <Input.Wrapper label={t.privacy} style={{ flex: 1, minWidth: 220 }}>
                        <Group gap={6} style={{ minHeight: 36, alignItems: 'center' }}>
                            {selectedProfiles.length > 0 ? selectedProfiles.map(id => {
                                const profile = privacyProfiles.find(p => p.id.toString() === id);
                                return profile ? (
                                    <Badge 
                                        key={id} 
                                        variant="outline" 
                                        size="lg" 
                                        color="green"
                                        leftSection={<IconShieldLock size={12} />}
                                        rightSection={
                                            <ActionIcon size="xs" variant="transparent" color="gray" onClick={() => {
                                                setSelectedProfiles(prev => prev.filter(pId => pId !== id));
                                            }}>
                                                <IconX size={12} />
                                            </ActionIcon>
                                        }
                                    >
                                        {profile.name}
                                    </Badge>
                                ) : null;
                            }) : <Text size="xs" c="dimmed" fs="italic">Drag rulesets here</Text>}
                        </Group>
                    </Input.Wrapper>
                </Group>
                <Group gap="xs">
                    {cloudSync && (
                        <Button 
                            variant="light" 
                            color="teal" 
                            size="xs"
                            leftSection={<IconCloudUpload size={16} />}
                            onClick={async () => {
                                const success = await syncShare(shareId);
                                if (success) {
                                    notifications.show({ title: 'Sync', message: 'Manual synchronization complete', color: 'teal' });
                                } else {
                                    notifications.show({ title: 'Sync Failed', message: 'Relay server might be unreachable', color: 'red' });
                                }
                            }}
                            loading={isLoading}
                        >
                            Sync
                        </Button>
                    )}
                    <Button 
                        size="xs"
                        onClick={handleSave} 
                        loading={isLoading}
                        leftSection={<IconCheck size={16} />}
                    >
                        {t.save}
                    </Button>
                    <ActionIcon 
                        variant="light" 
                        color="red" 
                        size="lg"
                        onClick={handleDelete}
                    >
                        <IconTrash size={20} />
                    </ActionIcon>
                </Group>
            </Group>
        </Paper>

        <Paper withBorder p="xs" radius="md" bg="var(--mantine-color-body)" style={{ flexShrink: 0 }}>
            <Stack gap="xs">
                <ContextBuilderSettings 
                    batchTag={batchTag} setBatchTag={setBatchTag}
                    batchQuery={batchQuery} setBatchQuery={setBatchQuery}
                    batchLimit={batchLimit} setBatchLimit={setBatchLimit}
                    responseFormat={responseFormat} setResponseFormat={setResponseFormat}
                    getAvailableTags={getAvailableTags}
                    handleFetchPreview={handleFetchPreview}
                />
                <Divider variant="dashed" />
                <Group gap="xs" wrap="nowrap">
                    <Badge variant="filled" color="blue" radius="xs" size="sm">GET</Badge>
                    <Text 
                        size="xs" 
                        style={{ 
                            wordBreak: 'break-all', 
                            fontFamily: 'monospace', 
                            flex: 1, 
                            color: 'var(--mantine-color-blue-7)',
                            padding: '4px 8px',
                            background: 'var(--mantine-color-gray-0)',
                            borderRadius: '4px',
                            border: '1px solid var(--mantine-color-gray-2)'
                        }}
                        darkHidden
                    >
                        {getDynamicUrl()}
                    </Text>
                    <Text 
                        size="xs" 
                        style={{ 
                            wordBreak: 'break-all', 
                            fontFamily: 'monospace', 
                            flex: 1, 
                            color: 'var(--mantine-color-blue-2)',
                            padding: '4px 8px',
                            background: 'var(--mantine-color-dark-8)',
                            borderRadius: '4px',
                            border: '1px solid var(--mantine-color-dark-7)'
                        }}
                        lightHidden
                    >
                        {getDynamicUrl()}
                    </Text>
                    <Group gap={5}>
                        <ActionIcon 
                            size="sm" 
                            variant="subtle" 
                            onClick={() => {
                                navigator.clipboard.writeText(getDynamicUrl());
                                notifications.show({ message: t.copied, color: 'blue' });
                            }}
                        >
                            <IconCopy size={16} />
                        </ActionIcon>
                        <ActionIcon 
                            size="sm" 
                            variant="subtle" 
                            component="a" 
                            href={getDynamicUrl()} 
                            target="_blank"
                        >
                            <IconExternalLink size={16} />
                        </ActionIcon>
                    </Group>
                </Group>
            </Stack>
        </Paper>

        <Stack gap="xs" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <Group justify="space-between" align="center" style={{ flexShrink: 0 }}>
                <Group gap="xs">
                    <Text size="sm" fw={700}>Preview Result</Text>
                    {previewCount !== null && (
                        <Badge variant="filled" color="blue" size="xs">
                            {previewCount} {previewCount === 1 ? 'file' : 'files'}
                        </Badge>
                    )}
                </Group>
                <SegmentedControl
                    size="xs"
                    value={responseFormat}
                    onChange={(val) => setResponseFormat(val as any)}
                    data={[
                        { label: 'Text', value: 'text' },
                        { label: 'JSON', value: 'json' },
                    ]}
                />
            </Group>
            <Paper 
                withBorder 
                p="xs" 
                className="preview-result-container"
                style={{ 
                    flex: 1,
                    overflow: 'auto',
                    background: 'var(--mantine-color-body)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                    cursor: 'text'
                }}
                onClick={handlePreviewClick}
            >
                <LoadingOverlay visible={previewLoading} overlayProps={{ blur: 1 }} />
                {previewContent ? (
                    <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                ) : (
                    <Text c="dimmed" ta="center" mt="xl">Adjust settings and click 'Test' to see the anonymized output.</Text>
                )}
            </Paper>
        </Stack>
    </Stack>
  );
};

const ContextBuilderSettings = ({ 
    batchTag, setBatchTag, 
    batchQuery, setBatchQuery, 
    batchLimit, setBatchLimit, 
    responseFormat, setResponseFormat,
    getAvailableTags,
    handleFetchPreview
}: any) => (
    <Group align="flex-end" gap="sm">
        <Select
            label="Filter Tag"
            size="sm"
            clearable
            placeholder="All Tags"
            data={getAvailableTags()}
            value={batchTag}
            onChange={setBatchTag}
            style={{ width: 160 }}
        />
        <TextInput
            label="Search Query"
            size="sm"
            placeholder="Search keywords..."
            leftSection={<IconSearch size={14} />}
            value={batchQuery}
            onChange={(e) => setBatchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
            style={{ flex: 1 }}
        />
        <TextInput
            label="Limit"
            size="sm"
            value={batchLimit.toString()}
            onChange={(e) => {
                const val = parseInt(e.target.value);
                setBatchLimit(isNaN(val) ? 0 : val);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
            style={{ width: 60 }}
        />
        <Button 
            onClick={handleFetchPreview}
            leftSection={<IconEye size={16} />}
        >
            Test
        </Button>
    </Group>
);
