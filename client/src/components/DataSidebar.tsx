import { NavLink, Stack, Text, Group, ActionIcon, ScrollArea, Tooltip, Badge, Box, Divider } from '@mantine/core';
import { IconKey, IconShieldLock, IconPlus, IconTag } from '@tabler/icons-react';
import { useAppStore } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';
import { translations } from '../i18n';
import { useEffect, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useShallow } from 'zustand/react/shallow';

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

// ... imports

export const DataSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    shares, fetchShares, privacyProfiles, fetchPrivacyProfiles, language, 
    generateShareKeyString, createShare, createPrivacyProfile,
    tags, fetchTags
  } = useAppStore(useShallow(state => ({
    shares: state.shares,
    fetchShares: state.fetchShares,
    privacyProfiles: state.privacyProfiles,
    fetchPrivacyProfiles: state.fetchPrivacyProfiles,
    language: state.language,
    generateShareKeyString: state.generateShareKeyString,
    createShare: state.createShare,
    createPrivacyProfile: state.createPrivacyProfile,
    tags: state.tags,
    fetchTags: state.fetchTags
  })));
  const t = translations[language];

  // Manually extract IDs from path since DataSidebar is outside the Route context
  const shareMatch = location.pathname.match(/\/data\/share\/(\d+)/);
  const rulesetMatch = location.pathname.match(/\/data\/ruleset\/(\d+)/);
  const currentShareId = shareMatch ? shareMatch[1] : null;
  const currentRulesetId = rulesetMatch ? rulesetMatch[1] : null;

  useEffect(() => {
    fetchShares();
    fetchPrivacyProfiles();
    if (tags.length === 0) fetchTags();
  }, []);

  const isShareActive = location.pathname.includes('/data/share/');
  const isRulesetActive = location.pathname.includes('/data/ruleset/');

  return (
    <ScrollArea h="100%" p="xs">
      <Stack gap="md">
        {/* SHARES SECTION */}
        <Stack gap="xs">
          <Group justify="space-between" px="xs">
            <Group gap="xs">
              <IconKey size={16} color="var(--mantine-color-blue-filled)" />
              <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                {t.apiKeys}
              </Text>
            </Group>
            <Tooltip label={t.createKey}>
              <ActionIcon 
                variant="subtle" 
                size="sm" 
                onClick={async () => {
                  const key = await generateShareKeyString();
                  await createShare(t.keyName + ' ' + (shares.length + 1), 'all', [], [], key || undefined);
                  fetchShares();
                }}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          
          <Stack gap={2}>
            {shares.map(share => (
              <NavLink
                key={share.id}
                label={share.name}
                leftSection={<IconKey size={14} />}
                active={isShareActive && currentShareId === share.id.toString()}
                onClick={() => navigate(`/data/share/${share.id}`)}
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
              <IconShieldLock size={16} color="var(--mantine-color-green-filled)" />
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
            <IconTag size={16} color="var(--mantine-color-orange-filled)" />
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
