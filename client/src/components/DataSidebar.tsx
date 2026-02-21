import { NavLink, Stack, Text, Group, ActionIcon, ScrollArea, Tooltip, Badge, Box, Divider } from '@mantine/core';
import { IconKey, IconShieldLock, IconPlus, IconDatabase, IconTag } from '@tabler/icons-react';
import { useAppStore } from '../store';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { translations } from '../i18n';
import { useEffect, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

const DraggableItem = ({ id, type, name, children }: { id: string | number, type: string, name: string, children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-${type}-${id}`,
    data: { type, id, name }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  } : undefined;

  return (
    <Box ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </Box>
  );
};

const DroppableRuleset = ({ profile, active, onClick }: { profile: any, active: boolean, onClick: () => void }) => {
  const [nativeOver, setNativeOver] = useState(false);
  const addPrivacyRule = useAppStore(state => state.addPrivacyRule);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `ruleset-drop-${profile.id}`,
    data: { type: 'RULESET_TARGET', id: profile.id }
  });

  const handleNativeDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setNativeOver(false);
      const text = e.dataTransfer.getData('text');
      if (text && profile.id) {
          addPrivacyRule(profile.id, {
              type: 'LITERAL',
              pattern: text,
              replacement: '[REDACTED]'
          });
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!nativeOver) setNativeOver(true);
  };

  return (
    <Box 
      ref={setNodeRef} 
      onDragEnter={() => setNativeOver(true)}
      onDragOver={handleDragOver}
      onDragLeave={() => setNativeOver(false)}
      onDrop={handleNativeDrop}
      style={{ 
        borderRadius: '4px',
        backgroundColor: (isOver || nativeOver) ? 'var(--mantine-color-blue-light)' : 'transparent',
        transition: 'background-color 0.2s ease'
      }}
    >
      <NavLink
        label={<DraggableItem id={profile.id} type="RULESET" name={profile.name}>{profile.name}</DraggableItem>}
        leftSection={<IconShieldLock size={14} color={(isOver || nativeOver) ? 'var(--mantine-color-blue-filled)' : undefined} />}
        active={active}
        onClick={onClick}
        variant="light"
        styles={{ label: { fontSize: '13px' } }}
      />
    </Box>
  );
};

import { useShallow } from 'zustand/react/shallow';

// ... imports

export const DataSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    apiKeys, fetchApiKeys, privacyProfiles, fetchPrivacyProfiles, language, 
    generateApiKeyString, createApiKey, createPrivacyProfile,
    tags, fetchTags
  } = useAppStore(useShallow(state => ({
    apiKeys: state.apiKeys,
    fetchApiKeys: state.fetchApiKeys,
    privacyProfiles: state.privacyProfiles,
    fetchPrivacyProfiles: state.fetchPrivacyProfiles,
    language: state.language,
    generateApiKeyString: state.generateApiKeyString,
    createApiKey: state.createApiKey,
    createPrivacyProfile: state.createPrivacyProfile,
    tags: state.tags,
    fetchTags: state.fetchTags
  })));
  const t = translations[language];

  // Manually extract IDs from path since DataSidebar is outside the Route context
  const keyMatch = location.pathname.match(/\/data\/key\/(\d+)/);
  const rulesetMatch = location.pathname.match(/\/data\/ruleset\/(\d+)/);
  const currentKeyId = keyMatch ? keyMatch[1] : null;
  const currentRulesetId = rulesetMatch ? rulesetMatch[1] : null;

  useEffect(() => {
    fetchApiKeys();
    fetchPrivacyProfiles();
    if (tags.length === 0) fetchTags();
  }, []);

  const isKeyActive = location.pathname.includes('/data/key/');
  const isRulesetActive = location.pathname.includes('/data/ruleset/');

  return (
    <ScrollArea h="100%" p="xs">
      <Stack gap="md">
        {/* API KEYS SECTION */}
        <Stack gap="xs">
          <Group justify="space-between" px="xs">
            <Group gap="xs">
              <IconKey size={16} c="blue" />
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                {t.apiKeys}
              </Text>
            </Group>
            <Tooltip label={t.createKey}>
              <ActionIcon 
                variant="subtle" 
                size="sm" 
                onClick={async () => {
                  const key = await generateApiKeyString();
                  await createApiKey(t.keyName + ' ' + (apiKeys.length + 1), 'all', [], key);
                  // Navigation will be handled by list update if we want, but better to navigate to the new key
                  fetchApiKeys();
                }}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          
          <Stack gap={2}>
            {apiKeys.map(key => (
              <NavLink
                key={key.id}
                label={key.name}
                leftSection={<IconKey size={14} />}
                active={isKeyActive && currentKeyId === key.id.toString()}
                onClick={() => navigate(`/data/key/${key.id}`)}
                variant="light"
                styles={{ label: { fontSize: '13px' } }}
              />
            ))}
          </Stack>
        </Stack>

        <Divider variant="dashed" mx="xs" />

        {/* RULESETS SECTION */}
        <Stack gap="xs">
          <Group justify="space-between" px="xs">
            <Group gap="xs">
              <IconShieldLock size={16} c="green" />
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                {t.privacy}
              </Text>
            </Group>
            <Tooltip label={t.createProfile}>
              <ActionIcon 
                variant="subtle" 
                size="sm"
                onClick={async () => {
                  await createPrivacyProfile(t.profileName + ' ' + (privacyProfiles.length + 1));
                  fetchPrivacyProfiles();
                }}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          
          <Stack gap={2}>
            {privacyProfiles.map(profile => (
              <DroppableRuleset 
                key={profile.id} 
                profile={profile} 
                active={isRulesetActive && currentRulesetId === profile.id.toString()}
                onClick={() => navigate(`/data/ruleset/${profile.id}`)}
              />
            ))}
          </Stack>
        </Stack>

        <Divider variant="dashed" mx="xs" />

        {/* TAGS SECTION */}
        <Stack gap="xs">
          <Group px="xs">
            <IconTag size={16} c="orange" />
            <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
              {t.tags}
            </Text>
          </Group>
          <Group gap={5} px="xs" wrap="wrap">
            {tags.map(tag => (
              <DraggableItem key={tag.id} id={tag.id} type="TAG" name={tag.name}>
                <Badge 
                  color={tag.color || 'blue'} 
                  variant="light" 
                  size="sm"
                  style={{ cursor: 'grab' }}
                >
                  {tag.name}
                </Badge>
              </DraggableItem>
            ))}
          </Group>
        </Stack>
      </Stack>
    </ScrollArea>
  );
};
