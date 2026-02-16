import { AppShell, Burger, Group, Text, ActionIcon, TextInput, Tooltip, Button, Tabs } from '@mantine/core';
import { IconSearch, IconX, IconSettings, IconLogout, IconFilter, IconDatabase } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../i18n';
import { ScriniaLogo } from './Logo';

interface HeaderProps {
  opened: boolean;
  toggle: () => void;
}

export const Header = ({ opened, toggle }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    logout, user, searchCriteria, setSearchCriteria, performSearch, 
    language, toggleLanguage, activeMainTab, setActiveMainTab,
    lastDataPath, setLastDataPath
  } = useAppStore();
  
  const t = translations[language];

  // Sync tab with location and remember path
  useEffect(() => {
    if (location.pathname.startsWith('/data')) {
      setActiveMainTab('data');
      setLastDataPath(location.pathname);
    } else {
      setActiveMainTab('filter');
    }
  }, [location.pathname]);

  const handleTabChange = (val: string | null) => {
    const tab = val as 'filter' | 'data';
    setActiveMainTab(tab);
    if (tab === 'filter') navigate('/');
    else navigate(lastDataPath);
  };

  const logo = (
    <Group gap="xs" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
      <ScriniaLogo size={32} showText={false} />
      <Group gap={0}>
        <Text fw={900} size="lg" c="blue.7" style={{ letterSpacing: -0.5 }}>Scrinia</Text>
      </Group>
    </Group>
  );

  return (
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between">
        <Group gap="xl">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            {logo}
          </Group>

          <Tabs value={activeMainTab} onChange={handleTabChange} variant="pills" size="xs">
            <Tabs.List>
              <Tabs.Tab value="filter" leftSection={<IconFilter size={14} />}>
                {t.filterTab}
              </Tabs.Tab>
              <Tabs.Tab value="data" leftSection={<IconDatabase size={14} />}>
                {t.dataTab}
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </Group>

        <Group gap="xs">
          {/* Statistics removed here as they are now in the DMS toolbar */}
        </Group>

        <Group>
          {user && (
            <Tooltip label={t.loggedInAs + ': ' + user.username}>
              <Group gap={5} mr="md" visibleFrom="lg">
                <Text size="xs" c="dimmed" fw={500}>{t.loggedInAs}:</Text>
                <Text size="xs" fw={700}>{user.username}</Text>
              </Group>
            </Tooltip>
          )}

          <Tooltip label={t.settings}>
            <ActionIcon 
              onClick={() => navigate('/settings')} 
              variant="default" 
              size="lg" 
              aria-label={t.settings}
            >
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
          
          <Tooltip label={t.changeLanguage}>
            <Button 
              variant="default" 
              size="xs" 
              onClick={toggleLanguage} 
              fw={700}
              style={{ textTransform: 'uppercase' }}
            >
              {language}
            </Button>
          </Tooltip>

          <Tooltip label={t.logout}>
            <ActionIcon onClick={logout} variant="default" size="lg" aria-label={t.logout}>
              <IconLogout size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </AppShell.Header>
  );
};
