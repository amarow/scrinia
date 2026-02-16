import { 
    Container, Button, Group, Text, Card, 
    useMantineColorScheme, SegmentedControl, Paper, Title
} from '@mantine/core';
import { 
    IconSunHigh, IconMoonStars, IconArrowLeft
} from '@tabler/icons-react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { translations } from '../i18n';

// Sub-components
import { SecuritySettings } from '../components/settings/SecuritySettings';

export function SettingsPage() {
    const { language, user } = useAppStore();
    const t = translations[language];
    const navigate = useNavigate();
    const { colorScheme, setColorScheme } = useMantineColorScheme();

    return (
        <div style={{ padding: 'var(--mantine-spacing-md)', height: '100%', boxSizing: 'border-box' }}>
            <Paper 
                style={{ 
                    height: 'calc(100vh - 92px)', 
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
                        
                        <SecuritySettings />
                    </Container>
                </div>
            </Paper>
        </div>
    );
}
