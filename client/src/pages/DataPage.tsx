import { Container, Stack, Text, Paper, Title, Center, Group } from '@mantine/core';
import { useParams, useLocation } from 'react-router-dom';
import { ShareDetail } from '../components/ShareDetail';
import { RulesetDetail } from '../components/RulesetDetail';
import { IconDatabase, IconClick } from '@tabler/icons-react';
import { useAppStore } from '../store';
import { translations } from '../i18n';

export function DataPage() {
    const { shareId, rulesetId } = useParams();
    const location = useLocation();
    const language = useAppStore(state => state.language);
    const t = translations[language];

    const isShareView = location.pathname.includes('/data/share/');
    const isRulesetView = location.pathname.includes('/data/ruleset/');

    const renderContent = () => {
        if (isShareView && shareId) {
            return <ShareDetail shareId={parseInt(shareId)} />;
        }
        if (isRulesetView && rulesetId) {
            return <RulesetDetail profileId={parseInt(rulesetId)} />;
        }

        return (
            <Center h="60vh">
                <Stack align="center" gap="xs">
                    <IconDatabase size={48} color="gray" stroke={1.5} />
                    <Title order={3} c="dimmed">Data & Share Management</Title>
                    <Group gap={4}>
                        <IconClick size={16} color="gray" />
                        <Text c="dimmed" size="sm">Select a Share or Ruleset from the sidebar to manage it.</Text>
                    </Group>
                </Stack>
            </Center>
        );
    };

    return (
        <Paper 
            p="md" 
            radius={0} 
            style={{ 
                height: 'calc(100vh - 60px)', 
                display: 'flex',
                flexDirection: 'column',
                background: 'transparent',
                border: 0,
                overflow: 'hidden',
                boxSizing: 'border-box'
            }}
        >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
                {renderContent()}
            </div>
        </Paper>
    );
}
