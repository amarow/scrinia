import { useState, useEffect } from 'react';
import { Container, Stack, Group, Select, Text, TextInput, Paper, ActionIcon, Button, ScrollArea, LoadingOverlay, Badge, Title, NumberInput, SegmentedControl } from '@mantine/core';
import { IconCopy, IconExternalLink, IconSearch, IconAdjustmentsHorizontal, IconFileText, IconBraces, IconEye, IconArrowLeft } from '@tabler/icons-react';
import { useAppStore } from '../store';
import { translations } from '../i18n';
import { API_BASE, authFetch } from '../store/utils';
import { notifications } from '@mantine/notifications';
import { useNavigate, useParams } from 'react-router-dom';

export function ContextExportPage() {
    const { shareId } = useParams();
    const navigate = useNavigate();
    const { tags, language, token, shares, fetchShares, fetchTags } = useAppStore();
    const t = translations[language];

    const [batchTag, setBatchTag] = useState<string | null>(null);
    const [batchQuery, setBatchQuery] = useState('');
    const [batchLimit, setBatchLimit] = useState<number>(50);
    const [responseFormat, setResponseFormat] = useState<'text' | 'json'>('text');
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [previewCount, setPreviewCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Find the specific Share
    const share = shares.find(k => k.id.toString() === shareId);

    useEffect(() => {
        if (token) {
            if (shares.length === 0) fetchShares();
            if (tags.length === 0) fetchTags();
        }
    }, [token]);

    // Trigger preview automatically when format changes
    useEffect(() => {
        if (share && responseFormat) {
            handleFetchPreview();
        }
    }, [responseFormat, share]);

    const getDynamicUrl = () => {
        if (!share) return '';
        let endpoint = responseFormat === 'json' ? 'json' : 'text';
        let url = `${API_BASE}/api/v1/files/${endpoint}?apiKey=${share.key}&limit=${batchLimit}`;
        if (batchTag) url += `&tag=${encodeURIComponent(batchTag)}`;
        if (batchQuery) url += `&q=${encodeURIComponent(batchQuery)}`;
        return url;
    };

    const handleFetchPreview = async () => {
        if (!share) return;
        setLoading(true);
        setPreviewCount(null);
        try {
            const res = await fetch(getDynamicUrl());
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
            setLoading(false);
        }
    };

    const getAvailableTags = () => {
        if (!share) return [];
        if (share.permissions.includes('all')) {
            return tags.map(t => ({ value: t.name, label: t.name }));
        }
        const allowedTagIds = share.tagIds || [];

        return tags
            .filter(t => allowedTagIds.includes(t.id))
            .map(t => ({ value: t.name, label: t.name }));
    };

    if (!share && !loading) {
        return (
            <Container size="md" py="xl">
                <Text>Share not found.</Text>
                <Button onClick={() => navigate('/settings')}>Back to Settings</Button>
            </Container>
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
            {/* Header Area */}
            <Group justify="space-between" mb="md" style={{ flexShrink: 0 }}>
                <Group gap="xs">
                    <Button 
                        variant="subtle" 
                        color="gray" 
                        leftSection={<IconArrowLeft size={20} />}
                        onClick={() => navigate('/settings')}
                    >
                        {t.back}
                    </Button>
                    <div style={{ borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: '1rem' }}>
                        <Title order={3}>Full Context Export: {share?.name}</Title>
                        <Text size="xs" c="dimmed">Configure and test batch data retrieval for AI agents</Text>
                    </div>
                </Group>
            </Group>

            {/* Content Area - Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                <Stack gap="md">
                    <Paper withBorder p="md">
                        <Group align="flex-end" gap="sm">
                            <Select
                                label="Filter Tag"
                                size="sm"
                                clearable
                                placeholder="All Tags"
                                data={getAvailableTags()}
                                value={batchTag}
                                onChange={setBatchTag}
                                style={{ width: 180 }}
                            />
                            <TextInput
                                label="Search Query"
                                size="sm"
                                placeholder="Search keywords in content..."
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
                    </Paper>

                    <Stack gap={4}>
                        <Text size="xs" fw={700} c="dimmed">GENERATED API URL</Text>
                        <Paper withBorder p="sm" bg="var(--mantine-color-dark-8)" style={{ borderRadius: '4px' }}>
                            <Group gap="xs" wrap="nowrap">
                                <Badge variant="filled" color="blue" radius="xs" size="sm">GET</Badge>
                                <Text 
                                    size="sm" 
                                    style={{ wordBreak: 'break-all', fontFamily: 'monospace', flex: 1, color: 'var(--mantine-color-blue-2)' }}
                                >
                                    {getDynamicUrl()}
                                </Text>
                                <Group gap="xs">
                                    <ActionIcon 
                                        size="lg" 
                                        variant="light" 
                                        onClick={() => {
                                            navigator.clipboard.writeText(getDynamicUrl());
                                            notifications.show({ message: 'URL copied to clipboard', color: 'blue' });
                                        }}
                                    >
                                        <IconCopy size={20} />
                                    </ActionIcon>
                                    <ActionIcon 
                                        size="lg" 
                                        variant="light" 
                                        component="a" 
                                        href={getDynamicUrl()} 
                                        target="_blank"
                                    >
                                        <IconExternalLink size={20} />
                                    </ActionIcon>
                                </Group>
                            </Group>
                        </Paper>
                    </Stack>

                    <Stack gap="xs" style={{ flex: 1, position: 'relative' }}>
                        <Group justify="space-between" align="center">
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
                            p="md" 
                            style={{ 
                                minHeight: '300px',
                                background: 'var(--mantine-color-body)',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                whiteSpace: 'pre-wrap',
                                position: 'relative'
                            }}
                        >
                            <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />
                            {previewContent || <Text c="dimmed" ta="center" mt="xl">Adjust settings and click 'Test' to see the anonymized output.</Text>}
                        </Paper>
                    </Stack>
                </Stack>
            </div>
        </Paper>
    );
}
