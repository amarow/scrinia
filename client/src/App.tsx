import { AppShell, Burger, Group, Text, ScrollArea, Button, Table, Loader, Alert, Stack, Badge, ActionIcon, TextInput, NavLink, Portal, Tooltip, useMantineColorScheme, Card, Title, PasswordInput, Center, Container, Modal, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTags, IconFiles, IconPlus, IconAlertCircle, IconX, IconSearch, IconFolder, IconExternalLink, IconTrash, IconSun, IconMoon, IconLogout, IconBrush, IconBan, IconArrowUp, IconCheck, IconHome, IconRefresh } from '@tabler/icons-react';
import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core';
import { TagItem, FileRow } from './components/DndComponents';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { 
    isAuthenticated, login, register, logout, error: storeError,
    files, scopes, tags, isLoading, error, 
    selectedScopeId, selectedTagId, searchQuery, activeStampTagId,
    init, addScope, refreshScope, deleteScope, addTagToFile, removeTagFromFile, createTag, deleteTag, openFile,
    setScopeFilter, setTagFilter, setSearchQuery, setStampMode
  } = useAppStore();
  
  // Auth State
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // App State
  const [newTagInput, setNewTagInput] = useState('');
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Directory Browser State
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [browserEntries, setBrowserEntries] = useState<any[]>([]);
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Virtualization Setup
  const parentRef = useRef<HTMLDivElement>(null);
  
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScope = selectedScopeId ? file.scopeId === selectedScopeId : true;
    const matchesTag = selectedTagId ? file.tags.some((t: any) => t.id === selectedTagId) : true;
    return matchesSearch && matchesScope && matchesTag;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let valA: any = a[sortBy];
    let valB: any = b[sortBy];

    if (sortBy === 'updatedAt') {
        valA = new Date(a.updatedAt).getTime();
        valB = new Date(b.updatedAt).getTime();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const rowVirtualizer = useVirtualizer({
    count: sortedFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // approximate row height
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (isAuthenticated) {
        init();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeStampTagId) {
        setStampMode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStampTagId, setStampMode]);

  const handleAuthSubmit = async () => {
    if (!username || !password) return;
    if (isRegistering) {
        await register(username, password);
        setIsRegistering(false); // Switch to login after register
    } else {
        await login(username, password);
    }
  };

  const fetchDirectory = async (path: string = '') => {
      setIsBrowserLoading(true);
      try {
          const { token } = useAppStore.getState();
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

  const handleCreateTag = async () => {
    if (newTagInput.trim()) {
        await createTag(newTagInput.trim());
        setNewTagInput('');
    }
  };

  const handleDeleteTag = async (e: React.MouseEvent, tag: any) => {
    e.stopPropagation();
    const fileCount = tag._count?.files || 0;
    if (fileCount > 0) {
        if (!window.confirm(`This tag is used by ${fileCount} files. Are you sure you want to delete it?`)) {
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
             addTagToFile(overId, tagName);
        }
    }

    if (activeType === 'FILE' && overType === 'TAG_TARGET') {
        const tagName = over.data.current?.name;
        if (tagName && activeId) {
             addTagToFile(activeId, tagName);
        }
    }
  };

  if (!isAuthenticated) {
      return (
          <Container size="xs" mt="xl">
              <Card withBorder shadow="sm" p="lg" radius="md">
                  <Title order={2} ta="center" mb="lg">Tagzilla</Title>
                  <Stack>
                      {storeError && <Alert color="red" title="Error">{storeError}</Alert>}
                      <TextInput 
                        label="Username" 
                        placeholder="Your username" 
                        required 
                        value={username} 
                        onChange={(e) => setUsername(e.currentTarget.value)}
                      />
                      <PasswordInput 
                        label="Password" 
                        placeholder="Your password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAuthSubmit()}
                      />
                      <Button fullWidth mt="md" onClick={handleAuthSubmit} loading={isLoading}>
                          {isRegistering ? 'Register' : 'Login'}
                      </Button>
                      <Text c="dimmed" size="sm" ta="center" style={{ cursor: 'pointer' }} onClick={() => setIsRegistering(!isRegistering)}>
                          {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
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
            <Text fw={700} size="lg">Tagzilla</Text>
          </Group>
          
          <Group>
            <TextInput 
                placeholder="Search files..." 
                leftSection={<IconSearch size={16} />} 
                style={{ width: 400 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                rightSection={
                searchQuery ? (
                    <ActionIcon variant="transparent" c="dimmed" onClick={() => setSearchQuery('')}>
                    <IconX size={14} />
                    </ActionIcon>
                ) : null
                }
            />
          </Group>

          <Group>
            <ActionIcon onClick={() => toggleColorScheme()} variant="default" size="lg" aria-label="Toggle color scheme">
                {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <ActionIcon onClick={logout} variant="default" size="lg" aria-label="Logout" title="Logout">
                <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <IconFolder size={20} />
              <Text fw={500}>Scopes</Text>
            </Group>
            <ActionIcon variant="light" size="sm" onClick={handleOpenBrowser} title="Add Scope">
              <IconPlus size={14} />
            </ActionIcon>
          </Group>
          
          <ScrollArea h={150}>
             <NavLink 
               label="All Files"
               active={!selectedScopeId && !selectedTagId}
               onClick={() => { setScopeFilter(null); setTagFilter(null); }}
               variant="light"
               mb={4}
             />
             {scopes.map(scope => (
               <NavLink 
                 key={scope.id} 
                 label={scope.name}
                 active={selectedScopeId === scope.id}
                 onClick={() => setScopeFilter(scope.id)}
                 rightSection={
                    <Group gap={4}>
                        <ActionIcon 
                            variant="transparent" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); refreshScope(scope.id); }}
                            title="Update Files"
                        >
                            <IconRefresh size={14} />
                        </ActionIcon>
                        <ActionIcon 
                            variant="transparent" 
                            size="sm" 
                            color="red"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if(confirm('Delete scope?')) deleteScope(scope.id); 
                            }}
                            title="Remove Scope"
                        >
                            <IconTrash size={14} />
                        </ActionIcon>
                    </Group>
                 }
                 variant="light"
                 mb={2}
               />
             ))}
             {scopes.length === 0 && <Text size="xs" c="dimmed" px="sm">No scopes added yet.</Text>}
          </ScrollArea>

          <Group justify="space-between" mt="md" mb="xs">
            <Group gap="xs">
              <IconTags size={20} />
              <Text fw={500}>Tags</Text>
            </Group>
          </Group>

          <TextInput 
            placeholder="New Tag..." 
            size="xs"
            mb="xs"
            leftSection={<IconPlus size={14} />} 
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
          />

          <ScrollArea h={300}>
            <Stack gap={4}>
              {tags.map(tag => (
                <TagItem 
                    key={tag.id} 
                    tag={tag} 
                    isSelected={selectedTagId === tag.id}
                    onClick={() => setTagFilter(tag.id)}
                >
                    <Group gap={0} wrap="nowrap">
                        <Button 
                        variant={selectedTagId === tag.id ? "filled" : (activeStampTagId === tag.id ? "light" : "light")}
                        color={activeStampTagId === tag.id ? "orange" : (selectedTagId === tag.id ? "blue" : "gray")}
                        fullWidth 
                        justify="space-between" 
                        size="xs"
                        rightSection={<Badge size="xs" variant="transparent" color="dark">{tag._count?.files}</Badge>}
                        style={{ pointerEvents: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: '1px solid rgba(0,0,0,0.1)' }} 
                        >
                        {tag.name}
                        </Button>
                        <ActionIcon 
                            size="30px" 
                            variant={activeStampTagId === tag.id ? "filled" : "light"}
                            color={activeStampTagId === tag.id ? "orange" : "gray"}
                            style={{ borderRadius: 0, borderRight: '1px solid rgba(0,0,0,0.1)' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setStampMode(activeStampTagId === tag.id ? null : tag.id);
                            }}
                            title={activeStampTagId === tag.id ? "Stop Stamping (Esc)" : "Stamp Mode"}
                        >
                            {activeStampTagId === tag.id ? <IconBan size={14} /> : <IconBrush size={14} />}
                        </ActionIcon>
                        <ActionIcon 
                            size="30px" 
                            variant={selectedTagId === tag.id ? "filled" : "light"}
                            color={selectedTagId === tag.id ? "blue" : "gray"}
                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                            onClick={(e) => handleDeleteTag(e, tag)}
                            title="Delete Tag"
                        >
                            <IconTrash size={14} />
                        </ActionIcon>
                    </Group>
                </TagItem>
              ))}
              {tags.length === 0 && <Text size="xs" c="dimmed">No tags created yet.</Text>}
            </Stack>
          </ScrollArea>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Group mb="md" justify="space-between">
           <Group>
             <IconFiles size={20} />
             <Text fw={500}>
                Files ({filteredFiles.length} / {files.length}) 
             </Text>
             {selectedTagId && <Badge color="blue">Tag Filter Active</Badge>}
             {selectedScopeId && <Badge color="green">Scope Filter Active</Badge>}
           </Group>
           {isLoading && <Loader size="xs" />}
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        <div 
          ref={parentRef} 
          style={{ 
            height: 'calc(100vh - 160px)', 
            overflow: 'auto',
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: '4px'
          }}
        >
          <Table verticalSpacing="xs" striped highlightOnHover style={{ tableLayout: 'fixed', minWidth: '100%' }}>
            <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--mantine-color-body)' }}>
              <Table.Tr>
                <Table.Th style={{ cursor: 'pointer', width: '50%' }} onClick={() => handleSort('name')}>
                  Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Table.Th>
                <Table.Th style={{ width: '25%' }}>Tags</Table.Th>
                <Table.Th style={{ cursor: 'pointer', width: '10%' }} onClick={() => handleSort('size')}>
                  Size {sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer', width: '15%' }} onClick={() => handleSort('updatedAt')}>
                  Updated {sortBy === 'updatedAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
               {virtualItems.length > 0 && (
                  <tr>
                      <td style={{ height: virtualItems[0]?.start || 0, padding: 0, border: 0 }} colSpan={4} />
                  </tr>
               )}
               {virtualItems.map((virtualRow) => {
                 const file = sortedFiles[virtualRow.index];
                 if (!file) return null;
                 return (
                    <FileRow key={file.id} file={file} data-index={virtualRow.index}>
                        <Table.Td 
                            style={{ cursor: activeStampTagId ? 'copy' : 'default' }}
                            onClick={(e: React.MouseEvent) => {
                                if (activeStampTagId) {
                                    e.stopPropagation();
                                    const tag = tags.find(t => t.id === activeStampTagId);
                                    if (tag) addTagToFile(file.id, tag.name);
                                }
                            }}
                        >
                            <Group gap="xs" wrap="nowrap">
                                <ActionIcon variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); openFile(file.id); }} title="Open in default app">
                                    <IconExternalLink size={16} />
                                </ActionIcon>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <Text size="sm" fw={500} style={{ wordBreak: 'break-all', cursor: activeStampTagId ? 'copy' : 'pointer' }} onClick={(e) => {
                                        if (activeStampTagId) {
                                            e.stopPropagation();
                                            const tag = tags.find(t => t.id === activeStampTagId);
                                            if (tag) addTagToFile(file.id, tag.name);
                                        } else {
                                            openFile(file.id);
                                        }
                                    }}>
                                        {file.name}
                                    </Text>
                                    <Text size="xs" c="dimmed" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.path}
                                    </Text>
                                </div>
                            </Group>
                        </Table.Td>
                        <Table.Td
                            style={{ cursor: activeStampTagId ? 'copy' : 'default' }}
                            onClick={(e: React.MouseEvent) => {
                                if (activeStampTagId) {
                                    e.stopPropagation();
                                    const tag = tags.find(t => t.id === activeStampTagId);
                                    if (tag) addTagToFile(file.id, tag.name);
                                }
                            }}
                        >
                            <Group gap={5}>
                            {file.tags.map((tag: any) => (
                                <Badge 
                                key={tag.id} 
                                variant="light" 
                                rightSection={
                                    <ActionIcon size="xs" color="blue" variant="transparent" onClick={(e) => { e.stopPropagation(); removeTagFromFile(file.id, tag.id); }}>
                                    <IconX size={10} />
                                    </ActionIcon>
                                }
                                >
                                {tag.name}
                                </Badge>
                            ))}
                            </Group>
                        </Table.Td>
                        <Table.Td>{(file.size / 1024).toFixed(1)} KB</Table.Td>
                        <Table.Td>{new Date(file.updatedAt).toLocaleDateString()}</Table.Td>
                    </FileRow>
                 );
               })}
               {virtualItems.length > 0 && (
                  <tr>
                      <td style={{ height: rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0), padding: 0, border: 0 }} colSpan={4} />
                  </tr>
               )}
            </Table.Tbody>
          </Table>
          
          {!isLoading && filteredFiles.length === 0 && (
            <Stack align="center" py="xl">
              <Text c="dimmed">No files match your filters.</Text>
            </Stack>
          )}
        </div>
      </AppShell.Main>

      <DragOverlay>
        {activeDragItem ? (
           <Button variant="filled" color="blue" size="xs" style={{ cursor: 'grabbing', opacity: 0.9 }}>
              {activeDragItem.name}
           </Button>
        ) : null}
      </DragOverlay>
    </AppShell>

    <Modal 
        opened={isBrowserOpen} 
        onClose={() => setIsBrowserOpen(false)} 
        title="Select Directory to Watch"
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
                <Button onClick={() => fetchDirectory(browserPath)} variant="default">Go</Button>
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
                        <Text c="dimmed" p="md" ta="center">Directory is empty</Text>
                    )}
                </ScrollArea>
            </Card>

            <Group justify="flex-end">
                <Button variant="default" onClick={() => setIsBrowserOpen(false)}>Cancel</Button>
                <Button onClick={handleBrowserSelect} leftSection={<IconCheck size={16} />}>
                    Select This Directory
                </Button>
            </Group>
        </Stack>
    </Modal>

    </DndContext>
  );
}