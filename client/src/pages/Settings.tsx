import { 
    Title, Container, Button, Group, Text, Card, Stack, 
    ActionIcon, ScrollArea, Modal, TextInput, Loader, Checkbox,
    useMantineColorScheme, SegmentedControl, PasswordInput, MultiSelect
} from '@mantine/core';
import { 
    IconFolder, IconPlus, IconRefresh, IconTrash, IconArrowUp, IconCheck,
    IconSunHigh, IconMoonStars, IconArrowLeft, IconKey, IconCopy, IconEye, IconEyeOff
} from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { translations } from '../i18n';

export function SettingsPage() {
    const { 
        scopes, addScope, refreshScope, deleteScope, token, 
        activeScopeIds, toggleScopeActive, language, user,
        changePassword, isLoading, tags,
        apiKeys, fetchApiKeys, createApiKey, deleteApiKey
    } = useAppStore();

    const t = translations[language];
    const navigate = useNavigate();
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // API Key State
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [selectedTagsForKey, setSelectedTagsForKey] = useState<string[]>([]);
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [revealedKeyIds, setRevealedKeyIds] = useState<number[]>([]);

    // Directory Browser State
    const [isBrowserOpen, setIsBrowserOpen] = useState(false);
    const [browserPath, setBrowserPath] = useState('');
    const [browserEntries, setBrowserEntries] = useState<any[]>([]);
    const [isBrowserLoading, setIsBrowserLoading] = useState(false);

    useEffect(() => {
        fetchApiKeys();
    }, []);

    // Escape Key Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isBrowserOpen) {
                    setIsBrowserOpen(false);
                } else {
                    navigate('/');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate, isBrowserOpen]);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) return;
        try {
            await changePassword(currentPassword, newPassword);
            setCurrentPassword('');
            setNewPassword('');
        } catch (e) {
            // Error handled in store (alert/state)
        }
    };

    const fetchDirectory = async (path: string = '') => {
        setIsBrowserLoading(true);
        try {
            if (!token) return;
            
            const url = new URL('http://localhost:3001/api/fs/list');
            if (path) url.searchParams.append('path', path);
            
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                setBrowserPath(data.currentPath);
                setBrowserEntries(data.entries);
            }
        } catch (e) {
            console.error("Failed to fetch directory", e);
        } finally {
            setIsBrowserLoading(false);
        }
    };

    const handleOpenBrowser = () => {
        setIsBrowserOpen(true);
        fetchDirectory(); // Fetch home dir initially
    };

    const handleBrowserSelect = async () => {
        await addScope(browserPath);
        setIsBrowserOpen(false);
    };

    return (
        <Container size="md" py="xl">
            <Group justify="space-between" mb="md">
                <Group>
                    <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/')}>
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                    <Title order={2}>{t.settings}</Title>
                </Group>
                <Text c="dimmed">{user?.username}</Text>
            </Group>
            
            <Card withBorder shadow="sm" radius="md">
                <Card.Section withBorder inheritPadding py="xs">
                    <Group justify="space-between">
                        <Stack gap={0}>
                            <Text fw={500}>{t.managedScopes}</Text>
                            <Text size="xs" c="dimmed">{t.checkScopes}</Text>
                        </Stack>
                        <Button 
                            leftSection={<IconPlus size={16} />} 
                            variant="light" 
                            size="xs" 
                            onClick={handleOpenBrowser}
                        >
                            {t.addScope}
                        </Button>
                    </Group>
                </Card.Section>

                <Stack gap="xs" mt="md">
                    {scopes.length === 0 && (
                        <Text c="dimmed" ta="center" py="md">{t.noScopesActive}</Text>
                    )}
                    
                    {scopes.map(scope => (
                        <Group key={scope.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px' }}>
                            <Group>
                                <Checkbox 
                                    checked={activeScopeIds.includes(scope.id)}
                                    onChange={() => toggleScopeActive(scope.id)}
                                    label={
                                        <div>
                                            <Group gap="xs">
                                                <IconFolder size={20} color="gray" style={{ display: 'inline' }} />
                                                <Text size="sm" fw={500} span>{scope.name}</Text>
                                            </Group>
                                            <Text size="xs" c="dimmed" pl={34}>{scope.path}</Text>
                                        </div>
                                    }
                                />
                            </Group>
                            <Group gap="xs">
                                <ActionIcon 
                                    variant="light" 
                                    onClick={() => refreshScope(scope.id)}
                                    title={t.rescan}
                                >
                                    <IconRefresh size={16} />
                                </ActionIcon>
                                <ActionIcon 
                                    variant="light" 
                                    color="red"
                                    onClick={() => { 
                                        if(confirm(t.deleteScope)) deleteScope(scope.id); 
                                    }}
                                    title={t.removeScope}
                                >
                                    <IconTrash size={16} />
                                </ActionIcon>
                            </Group>
                        </Group>
                    ))}
                </Stack>
            </Card>

            <Title order={3} mt="xl" mb="md">{t.appearance}</Title>
            <Card withBorder shadow="sm" radius="md">
                <Group justify="space-between">
                    <Group>
                        {colorScheme === 'dark' ? <IconMoonStars size={20} /> : <IconSunHigh size={20} />}
                        <Text fw={500}>{t.toggleTheme}</Text>
                    </Group>
                    <SegmentedControl 
                        value={colorScheme}
                        onChange={(val: any) => setColorScheme(val)}
                        data={[
                            { label: 'Light', value: 'light' },
                            { label: 'Dark', value: 'dark' },
                            { label: 'Auto', value: 'auto' }
                        ]}
                    />
                </Group>
            </Card>

            <Title order={3} mt="xl" mb="md">{t.security}</Title>
            <Card withBorder shadow="sm" radius="md">
                <form autoComplete="off">
                <Stack gap="md">
                    <Text fw={500}>{t.security}</Text>
                    {/* Fake hidden fields to trick browser */}
                    <input type="text" style={{display: 'none'}} autoComplete="username" />
                    <input type="password" style={{display: 'none'}} autoComplete="current-password" />

                    <Group align="flex-end">
                        <PasswordInput 
                            label={t.currentPassword} 
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                            autoComplete="current-password"
                            name="current_password_field"
                        />
                        <PasswordInput 
                            label={t.newPassword} 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.currentTarget.value)}
                            autoComplete="new-password"
                            name="new_password_field"
                        />
                        <Button 
                            onClick={handleChangePassword} 
                            loading={isLoading}
                            disabled={!currentPassword || !newPassword}
                        >
                            {t.update}
                        </Button>
                    </Group>
                </Stack>
                </form>
            </Card>

            <Title order={3} mt="xl" mb="md">{t.apiKeys}</Title>
            <Card withBorder shadow="sm" radius="md">
                <Card.Section withBorder inheritPadding py="xs">
                    <Group justify="space-between">
                        <Stack gap={0}>
                            <Text fw={500}>{t.apiKeys}</Text>
                            <Text size="xs" c="dimmed">{t.apiKeysDesc}</Text>
                        </Stack>
                        <Button 
                            leftSection={<IconPlus size={16} />} 
                            variant="light" 
                            size="xs" 
                            onClick={() => {
                                setCreatedKey(null);
                                setNewKeyName('');
                                setSelectedTagsForKey([]);
                                setIsKeyModalOpen(true);
                            }}
                        >
                            {t.createKey}
                        </Button>
                    </Group>
                </Card.Section>

                <Stack gap="xs" mt="md">
                    {apiKeys.length === 0 && (
                        <Text c="dimmed" ta="center" py="md">No API keys created yet.</Text>
                    )}
                    
                    {apiKeys.map(key => (
                        <Group key={key.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px' }}>
                            <Stack gap={4} style={{ flex: 1 }}>
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <IconKey size={20} color="gray" />
                                        <Text size="sm" fw={500}>{key.name}</Text>
                                    </Group>
                                    <Group gap={4}>
                                        <Text size="xs" family="monospace" c="dimmed">
                                            {revealedKeyIds.includes(key.id) ? key.key : '••••••••••••••••••••'}
                                        </Text>
                                        <ActionIcon 
                                            size="sm" 
                                            variant="subtle" 
                                            onClick={() => {
                                                setRevealedKeyIds(prev => 
                                                    prev.includes(key.id) ? prev.filter(id => id !== key.id) : [...prev, key.id]
                                                );
                                            }}
                                        >
                                            {revealedKeyIds.includes(key.id) ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                                        </ActionIcon>
                                        <ActionIcon 
                                            size="sm" 
                                            variant="subtle" 
                                            onClick={() => {
                                                if (key.key) {
                                                    navigator.clipboard.writeText(key.key);
                                                    alert('Key copied');
                                                }
                                            }}
                                        >
                                            <IconCopy size={14} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                                <Group gap="xs">
                                    <Text size="xs" c="dimmed">
                                        {t.lastUsed}: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : t.never}
                                    </Text>
                                    <Text size="xs" c="dimmed" style={{ borderLeft: '1px solid gray', paddingLeft: '8px' }}>
                                        {key.permissions.map(p => {
                                            if (p.startsWith('tag:')) {
                                                const id = parseInt(p.split(':')[1]);
                                                const tag = tags.find(t => t.id === id);
                                                return tag ? tag.name : p;
                                            }
                                            return p;
                                        }).join(', ')}
                                    </Text>
                                </Group>
                            </Stack>
                            <ActionIcon 
                                variant="light" 
                                color="red"
                                onClick={() => { 
                                    if(confirm('Delete this API key?')) deleteApiKey(key.id); 
                                }}
                            >
                                <IconTrash size={16} />
                            </ActionIcon>
                        </Group>
                    ))}
                </Stack>
            </Card>

            <Modal 
                opened={isKeyModalOpen} 
                onClose={() => setIsKeyModalOpen(false)} 
                title={t.createKey}
            >
                <Stack>
                    {!createdKey ? (
                        <>
                            <TextInput 
                                label={t.keyName} 
                                placeholder="e.g. Home Automation"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.currentTarget.value)}
                                autoFocus
                            />
                            <MultiSelect 
                                label={t.tags}
                                placeholder="Select tags this key can access"
                                data={tags.map(t => ({ value: String(t.id), label: t.name }))}
                                value={selectedTagsForKey}
                                onChange={setSelectedTagsForKey}
                            />
                            <Button 
                                onClick={async () => {
                                    const perms = selectedTagsForKey.length > 0 
                                        ? selectedTagsForKey.map(id => `tag:${id}`).join(',')
                                        : 'files:read,tags:read';
                                    const key = await createApiKey(newKeyName, perms);
                                    if (key) setCreatedKey(key.key || null);
                                }}
                                disabled={!newKeyName}
                                loading={isLoading}
                            >
                                {t.createKey}
                            </Button>
                        </>
                    ) : (
                        <Stack>
                            <Text size="sm" c="green" fw={500}>{t.keyCreated}</Text>
                            <Group gap="xs">
                                <TextInput 
                                    value={createdKey} 
                                    readOnly 
                                    style={{ flex: 1 }}
                                    styles={{ input: { fontFamily: 'monospace' } }}
                                />
                                <ActionIcon 
                                    size="lg" 
                                    variant="light"
                                    onClick={() => {
                                        navigator.clipboard.writeText(createdKey);
                                        alert('Copied to clipboard');
                                    }}
                                >
                                    <IconCopy size={20} />
                                </ActionIcon>
                            </Group>
                            <Button onClick={() => setIsKeyModalOpen(false)}>{t.save}</Button>
                        </Stack>
                    )}
                </Stack>
            </Modal>

            <Modal 
                opened={isBrowserOpen} 
                onClose={() => setIsBrowserOpen(false)} 
                title={t.selectDirectory}
                size="lg"
            >
                <Stack>
                    <Group>
                        <TextInput 
                            value={browserPath} 
                            onChange={(e) => setBrowserPath(e.currentTarget.value)}
                            style={{ flex: 1 }}
                            rightSection={isBrowserLoading ? <Loader size="xs" /> : null}
                            onKeyDown={(e) => e.key === 'Enter' && fetchDirectory(browserPath)}
                        />
                        <Button onClick={() => fetchDirectory(browserPath)} variant="default">{t.go}</Button>
                    </Group>
                    
                    <Card withBorder p={0}>
                        <ScrollArea h={300}>
                            {browserEntries.map((entry) => (
                                <Group 
                                    key={entry.path} 
                                    p="xs" 
                                    style={{ 
                                        cursor: 'pointer', 
                                        borderBottom: '1px solid var(--mantine-color-default-border)' 
                                    }}
                                    onClick={() => fetchDirectory(entry.path)}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    {entry.name === '..' ? <IconArrowUp size={16} /> : <IconFolder size={16} />}
                                    <Text size="sm">{entry.name}</Text>
                                </Group>
                            ))}
                            {browserEntries.length === 0 && !isBrowserLoading && (
                                <Text c="dimmed" p="md" ta="center">{t.directoryEmpty}</Text>
                            )}
                        </ScrollArea>
                    </Card>

                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setIsBrowserOpen(false)}>{t.cancel}</Button>
                        <Button onClick={handleBrowserSelect} leftSection={<IconCheck size={16} />}>
                            {t.select}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Container>
    );
}
