import { useState, useEffect } from 'react';
import { AppShell, Stack, Group, Text, TextInput, ActionIcon, ScrollArea, Button, Modal, ColorSwatch, Box, Checkbox, Divider, Tooltip } from '@mantine/core';
import { IconPlus, IconPencil, IconTrash, IconCheck, IconFolder, IconTag, IconDatabase, IconShieldLock } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import { translations } from '../i18n';
import { TagItem } from './DndComponents';
import { modals } from '@mantine/modals';
import { DirectoryPickerModal } from './DirectoryPickerModal';
import { useDraggable, useDroppable } from '@dnd-kit/core';

const TAG_COLORS = [
    '#fa5252', '#fd7e14', '#fab005', '#40c057', '#228be6', '#7950f2', '#e64980', '#868e96'
];

const DroppableRuleset = ({ profile }: { profile: any }) => {
    const [nativeOver, setNativeOver] = useState(false);
    const addPrivacyRule = useAppStore(state => state.addPrivacyRule);

    const { setNodeRef, isOver } = useDroppable({
      id: `ruleset-drop-sidebar-${profile.id}`,
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
          transition: 'background-color 0.2s ease',
          padding: '2px'
        }}
      >
        <Group gap="xs" p="4px 8px" style={{ cursor: 'default' }}>
            <IconShieldLock size={14} color={(isOver || nativeOver) ? 'var(--mantine-color-blue-filled)' : 'gray'} />
            <Text size="xs" fw={500}>{profile.name}</Text>
        </Group>
      </Box>
    );
};

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    tags, selectedTagIds, toggleTagFilter, selectSingleTag, createTag, 
    updateTag, deleteTag, language,
    scopes, activeScopeIds, toggleScopeActive, fetchScopes,
    addScope, deleteScope, updateScope,
    privacyProfiles, fetchPrivacyProfiles
  } = useAppStore();
  
  const t = translations[language];

  useEffect(() => {
    fetchScopes();
    fetchPrivacyProfiles();
  }, []);

  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Source Browser State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ id?: number, path?: string } | null>(null);

  const handleAddScope = () => {
    setPickerTarget(null);
    setIsPickerOpen(true);
  };

  const handleEditScope = (scope: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerTarget({ id: scope.id, path: scope.path });
    setIsPickerOpen(true);
  };

  const onDirectorySelected = async (path: string) => {
    if (pickerTarget?.id) {
        // Edit existing
        const name = path.split('/').pop() || path;
        await updateScope(pickerTarget.id, { path, name });
    } else {
        // Add new
        await addScope(path);
    }
    setIsPickerOpen(false);
    fetchScopes();
  };

  const handleDeleteScope = (scope: any, e: React.MouseEvent) => {
    e.stopPropagation();
    modals.openConfirmModal({
        title: t.deleteScopeTitle,
        children: <Text size="sm">{t.deleteScope}</Text>,
        labels: { confirm: t.delete, cancel: t.cancel },
        confirmProps: { color: 'red' },
        onConfirm: () => deleteScope(scope.id),
    });
  };

  const renderScope = (scope: any) => {
    const isActive = activeScopeIds.includes(scope.id);
    return (
        <Group 
            key={scope.id} 
            wrap="nowrap" 
            gap={0}
            style={{ 
                cursor: 'pointer',
                borderRadius: '4px',
                backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : 'transparent',
                marginBottom: '4px',
                transition: 'all 0.2s ease',
                border: `1px solid ${isActive ? 'var(--mantine-color-blue-light-color)' : 'transparent'}`,
                overflow: 'hidden'
            }}
            onClick={(e) => {
                e.stopPropagation();
                toggleScopeActive(scope.id);
            }}
        >
            <Button 
              variant="transparent"
              color={isActive ? "blue.7" : "gray"}
              fullWidth 
              size="xs"
              justify="flex-start"
              leftSection={<IconFolder size={14} />}
              style={{ 
                  pointerEvents: 'none', 
                  fontWeight: isActive ? 700 : 500,
                  height: '30px'
              }} 
            >
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <Text size="xs" fw={isActive ? 700 : 500} truncate>{scope.name}</Text>
                    <Text size="10px" c="dimmed" fw={400} truncate>{scope.path}</Text>
                </div>
            </Button>
            
            <Group gap={0}>
                <ActionIcon 
                    variant="subtle" 
                    color="gray" 
                    size="30px" 
                    onClick={(e) => handleEditScope(scope, e)}
                    style={{ borderRadius: 0 }}
                >
                    <IconPencil size={14} />
                </ActionIcon>
                <ActionIcon 
                    variant="subtle" 
                    color="red" 
                    size="30px" 
                    onClick={(e) => handleDeleteScope(scope, e)}
                    style={{ borderRadius: 0 }}
                >
                    <IconTrash size={14} />
                </ActionIcon>
            </Group>
        </Group>
    );
  };

  const renderTag = (tag: any) => {
    const isSelected = selectedTagIds.includes(tag.id);
    const tagColor = tag.color || "#228be6";
    const isSystem = (tag.isEditable as any) === 0;
    
    return (
    <TagItem 
        key={tag.id} 
        tag={tag} 
        isSelected={isSelected}
        onClick={(e: React.MouseEvent) => { 
            e.stopPropagation();
            toggleTagFilter(tag.id);
            navigate('/'); 
        }}
    >
        <Group 
            gap={0} 
            wrap="nowrap" 
            mb={4} 
            style={{ 
                borderRadius: '4px', 
                backgroundColor: isSelected ? tagColor : 'transparent',
                border: `1px solid ${isSelected ? tagColor : `${tagColor}40`}`,
                transition: 'all 0.2s ease',
                overflow: 'hidden'
            }}
        >
            <Button 
              variant="subtle"
              color={isSelected ? "white" : tagColor}
              fullWidth 
              size="xs"
              justify="space-between"
              leftSection={<IconTag size={14} />}
              rightSection={
                  <div style={{ width: 30, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                      <Text size="xs" fw={700} c={isSelected ? "white" : tagColor}>
                          {tag._count?.files}
                      </Text>
                  </div>
              }
              style={{ 
                  pointerEvents: 'none', 
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? 'white' : tagColor,
                  borderRadius: 0,
                  height: '30px'
              }} 
            >
            <Text size="xs" style={{ flex: 1, textAlign: 'center' }}>
                {tag.name}
            </Text>
            </Button>

            {!isSystem && (
                <>
                    <ActionIcon 
                        size="30px" 
                        variant="subtle"
                        color={isSelected ? "white" : tagColor}
                        style={{ borderRadius: 0 }}
                        onClick={(e) => openEditTagModal(tag, e)}
                        title={t.editTag}
                    >
                        <IconPencil size={14} />
                    </ActionIcon>
                    <ActionIcon 
                        size="30px" 
                        variant="subtle"
                        color={isSelected ? "white" : tagColor}
                        style={{ borderRadius: 0 }}
                        onClick={(e) => handleDeleteTag(e, tag)}
                        title={t.deleteTag}
                    >
                        <IconTrash size={14} />
                    </ActionIcon>
                </>
            )}
        </Group>
    </TagItem>
  )};

  const handleCreateTag = async () => {
    if (newTagInput.trim()) {
        await createTag(newTagInput.trim(), '#40c057');
        setNewTagInput('');
    }
  };

  const handleUpdateTag = () => {
      if (editingTag && editName.trim()) {
          setEditingTag(null);
          updateTag(editingTag.id, { name: editName, color: editColor });
      }
  };

  const openEditTagModal = (tag: any, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingTag(tag);
      setEditName(tag.name);
      setEditColor(tag.color || '#228be6');
  };

  const handleDeleteTag = async (e: React.MouseEvent, tag: any) => {
    e.stopPropagation();
    const fileCount = tag._count?.files || 0;
    
    modals.openConfirmModal({
        title: t.deleteTag,
        children: (
            <Text size="sm">
                {fileCount > 0 
                    ? t.deleteTagConfirm.replace('{count}', fileCount.toString())
                    : t.areYouSure}
            </Text>
        ),
        labels: { confirm: t.delete, cancel: t.cancel },
        confirmProps: { color: 'red' },
        onConfirm: () => deleteTag(tag.id),
    });
  };

  return (
    <>
      <Stack p="md" gap="xs" style={{ height: '100%', overflow: 'hidden' }}>
        <ScrollArea h="100%">
          <Stack gap="xl">
              
              {/* SOURCES SECTION */}
              <Stack gap="xs">
                <Group justify="space-between" px="xs">
                  <Group gap="xs">
                    <IconDatabase size={16} color="var(--mantine-color-blue-filled)" />
                    <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                      {t.managedScopes}
                    </Text>
                  </Group>
                  <Tooltip label={t.addScope}>
                    <ActionIcon variant="subtle" size="sm" onClick={handleAddScope}>
                      <IconPlus size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Stack gap={2}>
                  {scopes.map(renderScope)}
                  {scopes.length === 0 && (
                      <Text size="xs" c="dimmed" px="xs" fs="italic">No sources configured.</Text>
                  )}
                </Stack>
              </Stack>

              <Divider variant="dashed" />

              {/* TAGS SECTION */}
              <Stack gap="xs">
                <Group gap="xs" px="xs">
                  <IconTag size={16} color="var(--mantine-color-blue-filled)" />
                  <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t.tags}
                  </Text>
                </Group>
                <Stack gap={4}>
                  {tags.filter(t => (t.isEditable as any) === 0).map(renderTag)}

                  <Box mt="sm" mb="sm">
                    <form onSubmit={(e) => { e.preventDefault(); handleCreateTag(); }} autoComplete="off">
                        <TextInput 
                            placeholder={t.newTagName}
                            size="xs"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.currentTarget.value)}
                            autoComplete="off"
                            rightSection={
                                <ActionIcon variant="transparent" onClick={handleCreateTag} title={t.createTag}>
                                    <IconPlus size={16} />
                                </ActionIcon>
                            }
                        />
                    </form>
                  </Box>

                  {tags.filter(t => (t.isEditable as any) !== 0).map(renderTag)}
                  {tags.length === 0 && <Text size="xs" c="dimmed">No tags created yet.</Text>}
                </Stack>
              </Stack>

              <Divider variant="dashed" />

              {/* QUICK RULESETS SECTION */}
              <Stack gap="xs" pb="xl">
                <Group gap="xs" px="xs">
                  <IconShieldLock size={16} color="var(--mantine-color-green-filled)" />
                  <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t.privacy} (Drop Target)
                  </Text>
                </Group>
                <Stack gap={2}>
                  {privacyProfiles.map(profile => (
                    <DroppableRuleset key={profile.id} profile={profile} />
                  ))}
                  {privacyProfiles.length === 0 && (
                      <Text size="xs" c="dimmed" px="xs" fs="italic">No rulesets found.</Text>
                  )}
                </Stack>
              </Stack>

            </Stack>
          </ScrollArea>
        </Stack>

      <DirectoryPickerModal 
        opened={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={onDirectorySelected}
        initialPath={pickerTarget?.path}
        title={pickerTarget ? 'Change Source Directory' : undefined}
      />

      <Modal opened={!!editingTag} onClose={() => setEditingTag(null)} title={t.editTag} size="xs" centered>
        <Stack gap="lg">
            <TextInput 
                value={editName} 
                onChange={(e) => setEditName(e.currentTarget.value)} 
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTag();
                }}
                placeholder={t.tagName}
                size="md"
                data-autofocus
                styles={{
                    input: {
                        backgroundColor: `${editColor}15`,
                        color: editColor,
                        fontWeight: 700,
                        textAlign: 'center',
                        border: `1px solid ${editColor}30`,
                        fontSize: '1.1rem'
                    }
                }}
            />
            
            <Group gap={8} justify="center" wrap="wrap">
                {TAG_COLORS.map((color) => (
                    <ColorSwatch 
                        key={color} 
                        color={color} 
                        onClick={() => setEditColor(color)}
                        style={{ color: '#fff', cursor: 'pointer' }}
                        size={24}
                    >
                        {editColor === color && <IconCheck size={14} />}
                    </ColorSwatch>
                ))}
            </Group>

            <Button 
                fullWidth 
                onClick={handleUpdateTag} 
                variant="default"
            >
                {t.save}
            </Button>
        </Stack>
      </Modal>
    </>
  );
};