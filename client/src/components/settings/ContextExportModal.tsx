import { useState, useEffect } from 'react';
import { Modal, Stack, Group, Select, Text, TextInput, Paper, ActionIcon, Button, ScrollArea, LoadingOverlay, Badge, NumberInput, SegmentedControl } from '@mantine/core';
import { IconCopy, IconExternalLink, IconSearch, IconAdjustmentsHorizontal, IconFileText, IconBraces, IconEye } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';
import { API_BASE, authFetch } from '../../store/utils';
import { notifications } from '@mantine/notifications';

interface ContextExportModalProps {
    opened: boolean;
    onClose: () => void;
    apiKey: {
        id: number;
        name: string;
        key: string;
        permissions: string[];
    };
}

export const ContextExportModal = ({ opened, onClose, apiKey }: ContextExportModalProps) => {
    const { tags, language, token } = useAppStore();
    const t = translations[language];

    const [batchTag, setBatchTag] = useState<string | null>(null);
    const [batchQuery, setBatchQuery] = useState('');
    const [batchLimit, setBatchLimit] = useState<number>(50);
    const [responseFormat, setResponseFormat] = useState<'text' | 'json'>('text');
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [previewCount, setPreviewCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Trigger preview automatically when tag or format changes
    useEffect(() => {
        if (opened && apiKey && (batchTag || responseFormat)) {
            handleFetchPreview();
        }
    }, [batchTag, responseFormat, opened]);

    const getDynamicUrl = () => {
        let endpoint = responseFormat === 'json' ? 'json' : 'text';
        let url = `${API_BASE}/api/v1/files/${endpoint}?apiKey=${apiKey.key}&limit=${batchLimit}`;
        if (batchTag) url += `&tag=${encodeURIComponent(batchTag)}`;
        if (batchQuery) url += `&q=${encodeURIComponent(batchQuery)}`;
        return url;
    };

    const handleFetchPreview = async () => {
        if (!token) return;
        setLoading(true);
        setPreviewCount(null);
        try {
            const res = await authFetch(getDynamicUrl(), token);
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
        if (apiKey.permissions.includes('all')) {
            return tags.map(t => ({ value: t.name, label: t.name }));
        }
        const allowedTagIds = apiKey.permissions
            .filter(p => p.startsWith('tag:'))
            .map(p => parseInt(p.split(':')[1]));

        return tags
            .filter(t => allowedTagIds.includes(t.id))
            .map(t => ({ value: t.name, label: t.name }));
    };

    return (
        <Modal 
            opened={opened} 
            onClose={onClose} 
            title={
                <Group gap="xs">
                    <IconAdjustmentsHorizontal size={20} />
                    <Text fw={700}>Full Context Export Builder: {apiKey.name}</Text>
                </Group>
            }
            size="xl"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            <Stack gap="md">
                <Paper withBorder p="md" bg="var(--mantine-color-gray-0)" darkHidden>
                    <ContextSettings 
                        batchTag={batchTag} setBatchTag={setBatchTag}
                        batchQuery={batchQuery} setBatchQuery={setBatchQuery}
                        batchLimit={batchLimit} setBatchLimit={setBatchLimit}
                        responseFormat={responseFormat} setResponseFormat={setResponseFormat}
                        getAvailableTags={getAvailableTags}
                    />
                </Paper>
                <Paper withBorder p="md" bg="var(--mantine-color-dark-8)" lightHidden>
                    <ContextSettings 
                        batchTag={batchTag} setBatchTag={setBatchTag}
                        batchQuery={batchQuery} setBatchQuery={setBatchQuery}
                        batchLimit={batchLimit} setBatchLimit={setBatchLimit}
                        responseFormat={responseFormat} setResponseFormat={setResponseFormat}
                        getAvailableTags={getAvailableTags}
                    />
                </Paper>

                <Stack gap={4}>
                    <Text size="xs" fw={700} c="dimmed">EXPORT URL</Text>
                    <Paper withBorder p="4px 8px" bg="var(--mantine-color-dark-9)" style={{ borderRadius: '4px' }}>
                        <Group gap="xs" wrap="nowrap">
                            <Badge variant="filled" color="blue" radius="xs" size="sm">GET</Badge>
                            <Text 
                                size="xs" 
                                style={{ wordBreak: 'break-all', fontFamily: 'monospace', flex: 1 }}
                            >
                                {getDynamicUrl().replace(apiKey.key, '********************')}
                            </Text>
                            <Group gap={5}>
                                <ActionIcon 
                                    size="sm" 
                                    variant="subtle" 
                                    onClick={() => {
                                        navigator.clipboard.writeText(getDynamicUrl());
                                        notifications.show({ message: 'URL copied to clipboard', color: 'blue', size: 'xs' });
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
                    </Paper>
                </Stack>

                <Stack gap="xs" style={{ flex: 1, position: 'relative' }}>
                    <Group justify="space-between" align="center">
                        <Group gap="xs">
                            <Text size="sm" fw={700}>Export Preview</Text>
                            {previewCount !== null && (
                                <Badge variant="filled" color="blue" size="xs">
                                    {previewCount} {previewCount === 1 ? 'file' : 'files'}
                                </Badge>
                            )}
                        </Group>
                        <Group gap="xs">
                            <SegmentedControl
                                size="xs"
                                value={responseFormat}
                                onChange={(val) => setResponseFormat(val as any)}
                                data={[
                                    { label: 'Text', value: 'text' },
                                    { label: 'JSON', value: 'json' },
                                ]}
                            />
                            <Button 
                                size="compact-xs" 
                                variant="light" 
                                leftSection={<IconEye size={14} />}
                                onClick={handleFetchPreview}
                            >
                                Refresh
                            </Button>
                        </Group>
                    </Group>
                    <Paper 
                        withBorder 
                        p="xs" 
                        style={{ 
                            minHeight: '200px', 
                            maxHeight: '400px', 
                            overflow: 'auto', 
                            position: 'relative',
                            background: 'var(--mantine-color-body)',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            whiteSpace: 'pre-wrap'
                        }}
                    >
                        <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />
                        {previewContent || <Text c="dimmed" ta="center" mt="xl">Click 'Refresh Preview' to test the current configuration.</Text>}
                    </Paper>
                </Stack>
            </Stack>
        </Modal>
    );
};

const ContextSettings = ({ 
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
            size="xs"
            clearable
            placeholder="All Tags"
            data={getAvailableTags()}
            value={batchTag}
            onChange={setBatchTag}
            style={{ width: 140 }}
        />
        <TextInput
            label="Search Query"
            size="xs"
            placeholder="Search keywords..."
            leftSection={<IconSearch size={14} />}
            value={batchQuery}
            onChange={(e) => setBatchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
            style={{ flex: 1 }}
        />
        <TextInput
            label="Limit"
            size="xs"
            value={batchLimit.toString()}
            onChange={(e) => {
                const val = parseInt(e.target.value);
                setBatchLimit(isNaN(val) ? 0 : val);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
            style={{ width: 60 }}
        />
    </Group>
);
