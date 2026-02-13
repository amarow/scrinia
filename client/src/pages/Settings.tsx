import { 
    Title, Container, Button, Group, Text, Card, Stack, 
    ActionIcon, ScrollArea, Modal, TextInput, Loader, Checkbox,
    useMantineColorScheme, SegmentedControl, PasswordInput, MultiSelect,
    Select, Switch, Table, Badge, Paper, Center
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { 
    IconFolder, IconPlus, IconRefresh, IconTrash, IconArrowUp, IconCheck,
    IconSunHigh, IconMoonStars, IconArrowLeft, IconKey, IconCopy,
    IconShieldLock, IconSettings
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
        apiKeys, fetchApiKeys, createApiKey, deleteApiKey, updateApiKey,
        privacyProfiles, createPrivacyProfile, deletePrivacyProfile,
        fetchPrivacyRules, addPrivacyRule, deletePrivacyRule, togglePrivacyRule, updatePrivacyProfile
    } = useAppStore();

    const t = translations[language];
    const navigate = useNavigate();
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // API Key State
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
    const [newKeyName, setNewKeyName] = useState('');
    const [selectedTagsForKey, setSelectedTagsForKey] = useState<string[]>([]);
    const [selectedPrivacyProfileId, setSelectedPrivacyProfileId] = useState<string | null>(null);
    const [existingKeyString, setExistingKeyString] = useState<string | null>(null);

    // Privacy State
    const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
    const [activeProfileName, setActiveProfileName] = useState('');
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [rules, setRules] = useState<any[]>([]);
    const [newRule, setNewRule] = useState({ type: 'LITERAL', pattern: '', replacement: '[REDACTED]' });

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
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isBrowserOpen]);

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
            {/* Header Area - Fixed */}
            <Group justify="space-between" mb="md" style={{ flexShrink: 0 }}>
                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <Button 
                        variant="subtle" 
                        color="gray" 
                        leftSection={<IconArrowLeft size={20} />}
                        onClick={() => navigate('/')}
                    >
                        {t.back}
                    </Button>
                    <div style={{ minWidth: 0, borderLeft: '1px solid var(--mantine-color-default-border)', paddingLeft: '1rem' }}>
                        <Text fw={700} size="lg" truncate>{t.settings} {t.userLabel} {user?.username}</Text>
                    </div>
                </Group>
            </Group>

            {/* Content Area - Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }}>
                <Container size="md" py="xl">
                    <Title order={3} mb="md">{t.appearance}</Title>
                    <Card withBorder shadow="sm" radius="md" mb="xl">
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
                    
                    <Title order={3} mb="md">{t.managedScopes}</Title>
                    <Card withBorder shadow="sm" radius="md" mb="xl">
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
                                    {t.add}
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
                                                modals.openConfirmModal({
                                                    title: t.deleteScopeTitle,
                                                    children: <Text size="sm">{t.deleteScope}</Text>,
                                                    labels: { confirm: t.delete, cancel: t.cancel },
                                                    confirmProps: { color: 'red' },
                                                    onConfirm: () => deleteScope(scope.id),
                                                });
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

                    <Title order={3} mb="md">{t.security}</Title>
                    <Card withBorder shadow="sm" radius="md" mb="xl">
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

                    <Title order={3} mb="md">{t.apiKeys}</Title>
                    <Card withBorder shadow="sm" radius="md" mb="xl">
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
                                        setNewKeyName('');
                                        setSelectedTagsForKey([]);
                                        setIsKeyModalOpen(true);
                                    }}
                                >
                                    {t.add}
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
                                        <Group gap="xs">
                                            <IconKey size={20} color="gray" />
                                            <Text size="sm" fw={500}>{key.name}</Text>
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
                                            {(key as any).privacyProfileName && (
                                                <Badge variant="outline" size="xs" color="blue" leftSection={<IconShieldLock size={10} />}>
                                                    {(key as any).privacyProfileName}
                                                </Badge>
                                            )}
                                        </Group>
                                    </Stack>
                                    <Group gap="xs">
                                        <ActionIcon 
                                            variant="light" 
                                            onClick={() => {
                                                setEditingKeyId(key.id);
                                                setNewKeyName(key.name);
                                                setSelectedTagsForKey(key.permissions.filter(p => p.startsWith('tag:')).map(p => p.split(':')[1]));
                                                setSelectedPrivacyProfileId(key.privacyProfileId ? String(key.privacyProfileId) : 'none');
                                                setExistingKeyString(key.key || null);
                                                setIsKeyModalOpen(true);
                                            }}
                                        >
                                            <IconSettings size={16} />
                                        </ActionIcon>
                                        <ActionIcon 
                                            variant="light" 
                                            color="red"
                                            onClick={() => { 
                                                modals.openConfirmModal({
                                                    title: t.deleteKeyTitle,
                                                    children: <Text size="sm">{t.areYouSure}</Text>,
                                                    labels: { confirm: t.delete, cancel: t.cancel },
                                                    confirmProps: { color: 'red' },
                                                    onConfirm: () => deleteApiKey(key.id),
                                                });
                                            }}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                            ))}
                        </Stack>
                    </Card>

                    <Title order={3} mb="md">{t.privacy}</Title>
                    <Card withBorder shadow="sm" radius="md" mb="xl">
                        <Card.Section withBorder inheritPadding py="xs">
                            <Group justify="space-between">
                                <Stack gap={0}>
                                    <Text fw={500}>{t.privacy}</Text>
                                    <Text size="xs" c="dimmed">{t.privacyDesc}</Text>
                                </Stack>
                                <Button 
                                    leftSection={<IconPlus size={16} />} 
                                    variant="light" 
                                    size="xs" 
                                    onClick={() => {
                                        setActiveProfileId(null);
                                        setActiveProfileName('');
                                        setRules([]);
                                        setIsRulesModalOpen(true);
                                    }}
                                >
                                    {t.add}
                                </Button>
                            </Group>
                        </Card.Section>

                        <Stack gap="xs" mt="md">
                            {privacyProfiles.length === 0 && (
                                <Text c="dimmed" ta="center" py="md">No privacy profiles created yet.</Text>
                            )}
                            
                            {privacyProfiles.map(profile => (
                                <Group key={profile.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px' }}>
                                    <Group>
                                        <IconShieldLock size={20} color="gray" />
                                        <div>
                                            <Text size="sm" fw={500}>{profile.name}</Text>
                                            <Text size="xs" c="dimmed">{profile.ruleCount} {t.rules}</Text>
                                        </div>
                                    </Group>
                                    <Group gap="xs">
                                        <ActionIcon 
                                            variant="light" 
                                            onClick={async () => {
                                                const r = await fetchPrivacyRules(profile.id);
                                                setRules(r);
                                                setActiveProfileId(profile.id);
                                                setActiveProfileName(profile.name);
                                                setIsRulesModalOpen(true);
                                            }}
                                        >
                                            <IconSettings size={16} />
                                        </ActionIcon>
                                        <ActionIcon 
                                            variant="light" 
                                            color="red"
                                            onClick={() => { 
                                                modals.openConfirmModal({
                                                    title: t.deleteProfileTitle,
                                                    children: <Text size="sm">{t.areYouSure}</Text>,
                                                    labels: { confirm: t.delete, cancel: t.cancel },
                                                    confirmProps: { color: 'red' },
                                                    onConfirm: () => deletePrivacyProfile(profile.id),
                                                });
                                            }}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                            ))}
                        </Stack>
                    </Card>
                </Container>
            </div>

            <Modal 
                opened={isRulesModalOpen} 
                onClose={() => setIsRulesModalOpen(false)} 
                title={t.anonymization}
                size="xl"
            >
                <Stack>
                    <Group align="flex-end">
                        <TextInput 
                            label={t.profileName}
                            placeholder="e.g. My Privacy Rules"
                            value={activeProfileName}
                            onChange={(e) => setActiveProfileName(e.currentTarget.value)}
                            style={{ flex: 1 }}
                            autoFocus={!activeProfileId}
                        />
                        <Button 
                            variant="light"
                            onClick={async () => {
                                if (activeProfileId) {
                                    await updatePrivacyProfile(activeProfileId, activeProfileName);
                                } else if (activeProfileName.trim()) {
                                    const newProfile = await createPrivacyProfile(activeProfileName.trim());
                                    if (newProfile) {
                                        setActiveProfileId(newProfile.id);
                                        setActiveProfileName(newProfile.name);
                                    }
                                }
                            }}
                            disabled={!activeProfileName.trim()}
                            loading={isLoading}
                        >
                            <IconCheck size={16} />
                        </Button>
                    </Group>

                    {activeProfileId ? (
                        <>
                            <Card withBorder p="sm">
                                <Text fw={500} size="sm" mb="xs">{t.addRule}</Text>
                                <Group align="flex-end">
                                    <Select 
                                        label={t.type}
                                        data={[
                                            { value: 'LITERAL', label: t.literal },
                                            { value: 'REGEX', label: t.regex }
                                        ]}
                                        value={newRule.type}
                                        onChange={(val) => setNewRule({...newRule, type: val || 'LITERAL'})}
                                        style={{ width: 150 }}
                                    />
                                    <TextInput 
                                        label={t.pattern}
                                        placeholder="e.g. My Company Name"
                                        value={newRule.pattern}
                                        onChange={(e) => setNewRule({...newRule, pattern: e.currentTarget.value})}
                                        style={{ flex: 1 }}
                                    />
                                    <TextInput 
                                        label={t.replacement}
                                        value={newRule.replacement}
                                        onChange={(e) => setNewRule({...newRule, replacement: e.currentTarget.value})}
                                        style={{ width: 150 }}
                                    />
                                    <Button 
                                        onClick={async () => {
                                            if (activeProfileId && newRule.pattern.trim()) {
                                                await addPrivacyRule(activeProfileId, {
                                                    type: newRule.type as any,
                                                    pattern: newRule.pattern.trim(),
                                                    replacement: newRule.replacement
                                                });
                                                const r = await fetchPrivacyRules(activeProfileId);
                                                setRules(r);
                                                setNewRule({ type: 'LITERAL', pattern: '', replacement: '[REDACTED]' });
                                            }
                                        }}
                                        disabled={!newRule.pattern.trim()}
                                        loading={isLoading}
                                    >
                                        <IconPlus size={16} />
                                    </Button>
                                </Group>
                            </Card>

                            <Table striped highlightOnHover withTableBorder>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>{t.type}</th>
                                        <th style={{ textAlign: 'left' }}>{t.pattern}</th>
                                        <th style={{ textAlign: 'left' }}>{t.replacement}</th>
                                        <th style={{ width: 80, textAlign: 'left' }}>{t.active}</th>
                                        <th style={{ width: 50 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.map(rule => (
                                        <tr key={rule.id}>
                                            <td style={{ textAlign: 'left' }}><Badge size="xs" variant="light">{rule.type}</Badge></td>
                                            <td style={{ textAlign: 'left' }}><Text size="sm" style={{ fontFamily: 'monospace' }}>{rule.pattern}</Text></td>
                                            <td style={{ textAlign: 'left' }}><Text size="sm">{rule.replacement}</Text></td>
                                            <td style={{ textAlign: 'left' }}>
                                                <Switch 
                                                    checked={!!rule.isActive}
                                                    onChange={async (e) => {
                                                        await togglePrivacyRule(rule.id, e.currentTarget.checked, rule.profileId);
                                                        const r = await fetchPrivacyRules(rule.profileId);
                                                        setRules(r);
                                                    }}
                                                    size="xs"
                                                />
                                            </td>
                                            <td>
                                                <ActionIcon 
                                                    variant="subtle" 
                                                    color="red" 
                                                    onClick={async () => {
                                                        await deletePrivacyRule(rule.id, rule.profileId);
                                                        const r = await fetchPrivacyRules(rule.profileId);
                                                        setRules(r);
                                                    }}
                                                >
                                                    <IconTrash size={14} />
                                                </ActionIcon>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </>
                    ) : (
                        <Paper withBorder p="md" style={{ borderStyle: 'dashed', opacity: 0.6 }}>
                            <Center>
                                <Text size="sm" c="dimmed">{t.rules} {t.never}</Text>
                            </Center>
                        </Paper>
                    )}
                </Stack>
            </Modal>

            <Modal 
                opened={isKeyModalOpen} 
                onClose={() => {
                    setIsKeyModalOpen(false);
                    setEditingKeyId(null);
                    setNewKeyName('');
                    setSelectedTagsForKey([]);
                    setSelectedPrivacyProfileId(null);
                    setExistingKeyString(null);
                }} 
                title={editingKeyId ? t.apiKey : t.createKey}
            >
                <Stack>
                    <>
                        {editingKeyId && existingKeyString && (
                            <Group gap="xs">
                                <TextInput 
                                    label="API Key"
                                    value={existingKeyString} 
                                    readOnly 
                                    style={{ flex: 1 }}
                                    styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
                                />
                                <ActionIcon 
                                    size="lg" 
                                    variant="light"
                                    mt={24}
                                    onClick={() => {
                                        navigator.clipboard.writeText(existingKeyString);
                                        notifications.show({
                                            title: t.copied,
                                            message: '',
                                            color: 'green',
                                            icon: <IconCheck size={16} />
                                        });
                                    }}
                                >
                                    <IconCopy size={20} />
                                </ActionIcon>
                            </Group>
                        )}
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
                        <Select 
                            label={t.privacyProfile}
                            placeholder={t.noProfile}
                            data={[
                                { value: 'none', label: t.noProfile },
                                ...privacyProfiles.map(p => ({ value: String(p.id), label: p.name }))
                            ]}
                            value={selectedPrivacyProfileId}
                            onChange={setSelectedPrivacyProfileId}
                        />
                        <Button 
                            onClick={async () => {
                                const perms = selectedTagsForKey.length > 0 
                                    ? selectedTagsForKey.map(id => `tag:${id}`).join(',')
                                    : 'files:read,tags:read';
                                const profileId = selectedPrivacyProfileId && selectedPrivacyProfileId !== 'none' 
                                    ? parseInt(selectedPrivacyProfileId) 
                                    : null;
                                
                                if (editingKeyId) {
                                    await updateApiKey(editingKeyId, { 
                                        name: newKeyName, 
                                        permissions: perms as any, 
                                        privacyProfileId: profileId 
                                    });
                                } else {
                                    await createApiKey(newKeyName, perms, profileId || undefined);
                                }
                                setIsKeyModalOpen(false);
                                setEditingKeyId(null);
                                setNewKeyName('');
                                setSelectedTagsForKey([]);
                                setSelectedPrivacyProfileId(null);
                                setExistingKeyString(null);
                            }}
                            disabled={!newKeyName}
                            loading={isLoading}
                        >
                            {t.save}
                        </Button>
                    </>
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
        </Paper>
    );
}
