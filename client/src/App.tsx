import { AppShell, Burger, Group, Text, ScrollArea, Button, Stack, Badge, ActionIcon, TextInput, useMantineColorScheme, Card, PasswordInput, Container, Modal, ColorSwatch, Alert, Center, Checkbox, Loader, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTags, IconPlus, IconX, IconSearch, IconSunHigh, IconMoonStars, IconLogout, IconTrash, IconSettings, IconPencil, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core';
import { TagItem } from './components/DndComponents';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { SettingsPage } from './pages/Settings';
import { translations } from './i18n';

const TAG_COLORS = [
    '#fa5252', // Red
    '#fd7e14', // Orange
    '#fab005', // Yellow
    '#40c057', // Green
    '#228be6', // Blue
    '#7950f2', // Violet
    '#e64980', // Pink
    '#868e96'  // Gray
];

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isAuthenticated, login, register, logout, error: storeError,
    tags, isLoading, user,
    selectedTagIds, searchQuery, selectedFileIds,
    init, addTagToFile, addTagToMultipleFiles, createTag, deleteTag, updateTag,
    toggleTagFilter, selectSingleTag, setSearchQuery, language, toggleLanguage,
    searchMode, setSearchMode, performSearch, isSearching
  } = useAppStore();
  
  const t = translations[language];

  // Auth State
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // App State
  const [newTagInput, setNewTagInput] = useState('');
  const [activeDragItem, setActiveDragItem] = useState<any>(null);

  // Tag Edit State
  const [editingTag, setEditingTag] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (isAuthenticated) {
        init();
    }
  }, [isAuthenticated]);

  const handleAuthSubmit = async () => {
    if (!username || !password) return;
    if (isRegistering) {
        await register(username, password);
        setIsRegistering(false); 
    } else {
        await login(username, password);
    }
  };

  const handleCreateTag = async () => {
    if (newTagInput.trim()) {
        await createTag(newTagInput.trim(), '#40c057'); // Default Godzilla Green
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
    if (fileCount > 0) {
        if (!window.confirm(t.deleteTagConfirm.replace('{count}', fileCount.toString()))) {
            return;
        }
    }
    await deleteTag(tag.id);
  };

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    const activeId = active.data.current?.id;
    const overId = over.data.current?.id;

    if (activeType === 'TAG' && overType === 'FILE_TARGET') {
        const tagName = active.data.current?.name;
        if (tagName && overId) {
             if (selectedFileIds.includes(overId)) {
                 addTagToMultipleFiles(selectedFileIds, tagName);
             } else {
                 addTagToFile(overId, tagName);
             }
        }
    }

    if (activeType === 'FILE' && overType === 'TAG_TARGET') {
        const tagName = over.data.current?.name;
        if (tagName && activeId) {
             if (selectedFileIds.includes(activeId)) {
                 addTagToMultipleFiles(selectedFileIds, tagName);
             } else {
                 addTagToFile(activeId, tagName);
             }
        }
    }
  };

  const logo = (
    <Text fw={900} size="lg" style={{ cursor: 'pointer', letterSpacing: -0.5 }} onClick={() => navigate('/')}>
      {['T', 'a', 'g', 'Z', 'i', 'l', 'l', 'a'].map((char, i) => (
        <span key={i} style={{ color: TAG_COLORS[i % TAG_COLORS.length] }}>{char}</span>
      ))}
    </Text>
  );

  if (!isAuthenticated) {
      return (
          <Container size="xs" mt="xl">
              <Card withBorder shadow="sm" p="lg" radius="md">
                  <Center mb="lg">{logo}</Center>
                  <Stack>
                      {storeError && <Alert color="red" title="Error">{storeError}</Alert>}
                      <TextInput 
                        label={t.username} 
                        placeholder={t.username} 
                        required 
                        value={username} 
                        onChange={(e) => setUsername(e.currentTarget.value)}
                      />
                      <PasswordInput 
                        label={t.password} 
                        placeholder={t.password} 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
                      />
                      <Button fullWidth mt="md" onClick={handleAuthSubmit} loading={isLoading}>
                          {isRegistering ? t.register : t.login}
                      </Button>
                      <Text c="dimmed" size="sm" ta="center" style={{ cursor: 'pointer' }} onClick={() => setIsRegistering(!isRegistering)}>
                          {isRegistering ? t.alreadyHaveAccount : t.dontHaveAccount}
                      </Text>
                  </Stack>
              </Card>
          </Container>
      );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            {logo}
          </Group>

          
          <Group gap="sm">
            <form action="." autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (searchMode === 'content') performSearch(); }}>
            <TextInput 
                placeholder={t.searchPlaceholder}
                leftSection={<IconSearch size={16} />} 
                style={{ width: 400 }}
                value={searchQuery}
                autoComplete="off"
                name="tagzilla_global_search"
                onChange={(e) => {
                    setSearchQuery(e.currentTarget.value);
                    if (location.pathname !== '/') navigate('/');
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchMode === 'content') {
                        performSearch();
                    }
                }}
                rightSection={
                    isSearching ? <Loader size="xs" /> : (
                        searchQuery ? (
                            <ActionIcon variant="transparent" c="dimmed" onClick={() => setSearchQuery('')}>
                                <IconX size={14} />
                            </ActionIcon>
                        ) : null
                    )
                }
            />
            </form>
            <Checkbox
                label={t.searchContent}
                checked={searchMode === 'content'}
                onChange={(e) => setSearchMode(e.currentTarget.checked ? 'content' : 'filename')}
                size="xs"
            />
          </Group>

          <Group>
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

            {user && (
                <Text size="sm" fw={500} c="dimmed" mr="xs">
                   {user.username}
                </Text>
            )}

            <Tooltip label={t.logout}>
                <ActionIcon onClick={logout} variant="default" size="lg" aria-label={t.logout}>
                    <IconLogout size={18} />
                </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" onClick={() => { if (location.pathname === '/settings') navigate('/'); }} style={{ cursor: location.pathname === '/settings' ? 'pointer' : 'default' }}>
        <Stack gap="xs">
          
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconTags size={20} />
              <Text fw={500}>{t.tags}</Text>
            </Group>
          </Group>

          <Stack gap={5}>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateTag(); }} autoComplete="off">
                <TextInput 
                    placeholder={t.newTagName}
                    size="xs"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.currentTarget.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    name="tagzilla_create_new_tag_field"
                    id="tagzilla_create_new_tag_field"
                    rightSection={
                        <ActionIcon variant="transparent" onClick={handleCreateTag} title={t.createTag}>
                            <IconPlus size={16} />
                        </ActionIcon>
                    }
                />
            </form>
          </Stack>

          <ScrollArea h="calc(100vh - 180px)" mt="sm">
            <Stack gap={4}>
              {tags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                <TagItem 
                    key={tag.id} 
                    tag={tag} 
                    isSelected={isSelected}
                    onClick={(e: React.MouseEvent) => { 
                        e.stopPropagation();
                        if (e.ctrlKey || e.metaKey) {
                            toggleTagFilter(tag.id); 
                        } else {
                            if (selectedTagIds.length === 1 && selectedTagIds[0] === tag.id) {
                                toggleTagFilter(tag.id); // Toggle off if it's the only one selected
                            } else {
                                selectSingleTag(tag.id);
                            }
                        }
                        navigate('/'); 
                    }}
                >
                    <Group gap={0} wrap="nowrap">
                        <Button 
                        variant={isSelected ? "light" : "subtle"}
                        color={isSelected ? (tag.color || "appleBlue") : "gray"}
                        fullWidth 
                        size="xs"
                        justify="space-between"
                        leftSection={<div style={{ width: 30 }} />} // Spacer to balance the right-side count
                        rightSection={
                            <div style={{ width: 30, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                                <Text size="xs" fw={700} c={isSelected ? (tag.color || "appleBlue") : "dimmed"}>
                                    {tag._count?.files}
                                </Text>
                            </div>
                        }
                        style={{ 
                            pointerEvents: 'none', 
                            borderTopRightRadius: 0, 
                            borderBottomRightRadius: 0, 
                            borderRight: '1px solid rgba(0,0,0,0.1)',
                            fontWeight: 500
                        }} 
                        >
                        <Text size="xs" fw={600} style={{ flex: 1, textAlign: 'center' }}>
                            {tag.name}
                        </Text>
                        </Button>
                        <ActionIcon 
                            size="30px" 
                            variant={isSelected ? "light" : "subtle"}
                            color={isSelected ? (tag.color || "appleBlue") : (tag.color || "gray")}
                            style={{ borderRadius: 0, borderRight: '1px solid rgba(0,0,0,0.1)' }}
                            onClick={(e) => openEditTagModal(tag, e)}
                            title={t.editTag}
                        >
                            <IconPencil size={14} />
                        </ActionIcon>
                        <ActionIcon 
                            size="30px" 
                            variant={isSelected ? "light" : "subtle"}
                            color={isSelected ? (tag.color || "appleBlue") : "gray"}
                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                            onClick={(e) => handleDeleteTag(e, tag)}
                            title={t.removeScope}
                        >
                            <IconTrash size={14} />
                        </ActionIcon>
                    </Group>
                </TagItem>
              )})}
              {tags.length === 0 && <Text size="xs" c="dimmed">No tags created yet.</Text>}
            </Stack>
          </ScrollArea>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell.Main>

      <DragOverlay>
        {activeDragItem ? (
           <Button 
             variant="filled" 
             size="xs" 
             style={{ cursor: 'grabbing', opacity: 0.9 }}
             rightSection={
                 (activeDragItem.type === 'FILE' && selectedFileIds.includes(activeDragItem.id) && selectedFileIds.length > 1) 
                 ? <Badge size="xs" circle color="white" c="appleBlue.6">{selectedFileIds.length}</Badge> 
                 : null
             }
           >
              {activeDragItem.name}
           </Button>
        ) : null}
      </DragOverlay>
    </AppShell>

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
                        backgroundColor: `${editColor}15`, // ~8% opacity for "light" effect
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
    </DndContext>
  );
}