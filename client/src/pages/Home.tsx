import { Group, Text, Loader, Alert, Stack, Badge, Table, ActionIcon, Button, Center, Checkbox, Tooltip, LoadingOverlay, TextInput, Paper } from '@mantine/core';
import { IconFiles, IconAlertCircle, IconX, IconHammer, IconRefresh, IconExternalLink, IconFolder, IconSearch } from '@tabler/icons-react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileRow } from '../components/DndComponents';
import { useNavigate } from 'react-router-dom';
import { translations } from '../i18n';
import { FilePreviewPanel } from '../components/FilePreviewPanel';
import { useShallow } from 'zustand/react/shallow';

export function HomePage() {

  const { 
    files, isLoading, error, 
    activeScopeIds, selectedTagIds, 
    searchCriteria, searchResults, isSearching, setSearchCriteria, performSearch,
    selectedFileIds, toggleFileSelection, setFileSelection, clearFileSelection,
    removeTagFromFile, language, refreshAllScopes,
    setPreviewFileId, previewFileId, openFile, openDirectory
  } = useAppStore(useShallow(state => ({
    files: state.files,
    isLoading: state.isLoading,
    error: state.error,
    activeScopeIds: state.activeScopeIds,
    selectedTagIds: state.selectedTagIds,
    searchCriteria: state.searchCriteria,
    searchResults: state.searchResults,
    isSearching: state.isSearching,
    setSearchCriteria: state.setSearchCriteria,
    performSearch: state.performSearch,
    selectedFileIds: state.selectedFileIds,
    toggleFileSelection: state.toggleFileSelection,
    setFileSelection: state.setFileSelection,
    clearFileSelection: state.clearFileSelection,
    removeTagFromFile: state.removeTagFromFile,
    language: state.language,
    refreshAllScopes: state.refreshAllScopes,
    setPreviewFileId: state.setPreviewFileId,
    previewFileId: state.previewFileId,
    openFile: state.openFile,
    openDirectory: state.openDirectory
  })));

  const t = translations[language];
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isReady, setIsReady] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      // Defer heavy calculation to allow initial paint
      const timer = requestAnimationFrame(() => setIsReady(true));
      return () => cancelAnimationFrame(timer);
  }, []);

  const handleSort = (field: 'name' | 'size' | 'updatedAt') => {
      if (sortBy === field) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(field);
          setSortOrder('desc'); // Default to desc for new sort
      }
  };

  const filteredFiles = useMemo(() => {
    if (!isReady) return [];

    const { filename, content, directory, enabled } = searchCriteria;
    
    let sourceFiles = files;
    
    // Check if search is active AND has input
    const hasSearchInput = filename.trim() || content.trim() || directory.trim();
    const isSearchActive = enabled && hasSearchInput;
    
    if (isSearchActive) {
        if (searchResults.length > 0) {
            sourceFiles = searchResults;
        } else if (!isSearching) {
            // Search active but no results from API
            return [];
        }
    }


    
    const result = sourceFiles.filter(file => {
      // Logic:
      // 1. Scope Match
      const matchesScope = activeScopeIds.length > 0 ? activeScopeIds.includes(file.scopeId) : false;
      
      // 2. Tag Match (OR Logic: match ANY selected tag)
      // If no tags selected, match all.
      const matchesTag = selectedTagIds.length > 0 
        ? file.tags.some((t: any) => selectedTagIds.includes(t.id)) 
        : true;
      
      return matchesScope && matchesTag;
    });

    return result;
  }, [files, searchResults, searchCriteria, activeScopeIds, selectedTagIds, isSearching, isReady]);



  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      if (sortBy === 'updatedAt') {
          // Assuming ISO 8601 strings, direct string comparison is faster and correct
          if (a.updatedAt < b.updatedAt) return sortOrder === 'asc' ? -1 : 1;
          if (a.updatedAt > b.updatedAt) return sortOrder === 'asc' ? 1 : -1;
          return 0;
      }

      const valA = a[sortBy];
      const valB = b[sortBy];

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredFiles, sortBy, sortOrder]);

  const rowVirtualizer = useVirtualizer({
    count: sortedFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // approximate row height
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const selectedIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);
  
  const allFilteredSelected = useMemo(() => {
      if (filteredFiles.length === 0) return false;
      return filteredFiles.every(f => selectedIdSet.has(f.id));
  }, [filteredFiles, selectedIdSet]);

  const someFilteredSelected = useMemo(() => {
       if (allFilteredSelected) return false;
       return filteredFiles.some(f => selectedIdSet.has(f.id));
  }, [filteredFiles, selectedIdSet, allFilteredSelected]);

  const handleSelectAll = () => {
      if (allFilteredSelected) {
          clearFileSelection();
      } else {
          const newIds = filteredFiles.map(f => f.id);
          const uniqueIds = Array.from(new Set([...selectedFileIds, ...newIds]));
          setFileSelection(uniqueIds);
      }
  };

  if (activeScopeIds.length === 0 && !isLoading) {
      return (
          <Center h="calc(100vh - 100px)">
              <Stack align="center">
                  <Text size="lg" fw={500} c="dimmed">{t.noScopesActive}</Text>
                  <Text size="sm" c="dimmed">{t.goToSettings}</Text>
                  <Button leftSection={<IconHammer size={16} />} onClick={() => navigate('/settings')}>
                      {t.settings}
                  </Button>
              </Stack>
          </Center>
      );
  }

  // If a file is selected for preview, show the panel instead of the list
  // Use display: none instead of conditional rendering to preserve scroll position and virtualizer state
  return (
    <div style={{ padding: 'var(--mantine-spacing-md)', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: previewFileId ? 'block' : 'none', height: '100%' }}>
            {previewFileId && <FilePreviewPanel />}
        </div>

        <div style={{ display: previewFileId ? 'none' : 'block' }}>
            <Paper withBorder p="xs" mb="md" radius="sm" shadow="xs">
                <Group justify="space-between">
                    <Group gap="xl">
                        <Group gap="xs">
                            <IconFiles size={20} c="blue" />
                            <Text fw={700} size="sm">
                                {filteredFiles.length} / {files.length} {t.files}
                            </Text>
                            {selectedFileIds.length > 0 && (
                                <Badge color="violet" variant="filled">
                                    {t.selected.replace('{count}', selectedFileIds.length.toString())}
                                </Badge>
                            )}
                        </Group>

                        <form action="." autoComplete="off" onSubmit={(e) => { e.preventDefault(); performSearch(); }} style={{ flex: 1 }}>
                            <Group gap="xs">
                                <TextInput 
                                    placeholder={t.searchModeDirectory || 'Verzeichnis'}
                                    leftSection={<IconSearch size={14} />}
                                    style={{ width: 160 }}
                                    value={searchCriteria.directory}
                                    disabled={!searchCriteria.enabled}
                                    size="xs"
                                    onChange={(e) => setSearchCriteria({ directory: e.currentTarget.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                    rightSection={
                                        searchCriteria.directory ? (
                                            <ActionIcon variant="transparent" c="dimmed" size="xs" onClick={() => setSearchCriteria({ directory: '' })}>
                                                <IconX size={12} />
                                            </ActionIcon>
                                        ) : null
                                    }
                                />

                                <TextInput 
                                    placeholder={t.name || 'Dateiname'}
                                    leftSection={<IconSearch size={14} />}
                                    style={{ width: 160 }}
                                    value={searchCriteria.filename}
                                    disabled={!searchCriteria.enabled}
                                    size="xs"
                                    onChange={(e) => setSearchCriteria({ filename: e.currentTarget.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                    rightSection={
                                        searchCriteria.filename ? (
                                            <ActionIcon variant="transparent" c="dimmed" size="xs" onClick={() => setSearchCriteria({ filename: '' })}>
                                                <IconX size={12} />
                                            </ActionIcon>
                                        ) : null
                                    }
                                />

                                <TextInput 
                                    placeholder={t.searchContent || 'Inhalt'}
                                    leftSection={<IconSearch size={14} />}
                                    style={{ flex: 1, minWidth: 200 }}
                                    value={searchCriteria.content}
                                    disabled={!searchCriteria.enabled}
                                    size="xs"
                                    onChange={(e) => setSearchCriteria({ content: e.currentTarget.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                    rightSection={
                                        searchCriteria.content ? (
                                            <ActionIcon variant="transparent" c="dimmed" size="xs" onClick={() => setSearchCriteria({ content: '' })}>
                                                <IconX size={12} />
                                            </ActionIcon>
                                        ) : null
                                    }
                                />

                                <Button 
                                    variant={searchCriteria.enabled ? "filled" : "default"}
                                    size="xs"
                                    onClick={() => setSearchCriteria({ enabled: !searchCriteria.enabled })}
                                >
                                    {searchCriteria.enabled ? t.on : t.off}
                                </Button>
                            </Group>
                        </form>
                    </Group>

                    <Tooltip label="Rescan active folders">
                        <ActionIcon variant="light" color="gray" size="md" onClick={() => refreshAllScopes()} loading={isLoading}>
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Paper>

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
                borderRadius: '4px',
                position: 'relative'
            }}
            >
            <LoadingOverlay visible={isLoading || isSearching || !isReady} overlayProps={{ blur: 1 }} loaderProps={{ size: 'md', type: 'dots' }} />
            <Table verticalSpacing="xs" striped highlightOnHover style={{ tableLayout: 'fixed', minWidth: '100%' }}>
                <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--mantine-color-body)' }}>
                <Table.Tr>
                    <Table.Th style={{ width: '40px' }}>
                        <Checkbox 
                            checked={allFilteredSelected}
                            indeterminate={someFilteredSelected}
                            onChange={handleSelectAll}
                        />
                    </Table.Th>
                    <Table.Th style={{ cursor: 'pointer', width: '40%' }} onClick={() => handleSort('name')}>
                    {t.name} {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </Table.Th>
                    <Table.Th style={{ width: '80px' }}></Table.Th>
                    <Table.Th style={{ width: '25%' }}>{t.tags}</Table.Th>
                    <Table.Th style={{ cursor: 'pointer', width: '10%' }} onClick={() => handleSort('size')}>
                    {t.size} {sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </Table.Th>
                    <Table.Th style={{ cursor: 'pointer', width: '15%' }} onClick={() => handleSort('updatedAt')}>
                    {t.updated} {sortBy === 'updatedAt' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </Table.Th>
                </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                {filteredFiles.length === 0 && (isLoading || isSearching || !isReady) ? (
                    <tr>
                        <td colSpan={5}>
                            <Center h={200}>
                                <Loader type="dots" />
                            </Center>
                        </td>
                    </tr>
                ) : (
                    <>
                    {virtualItems.length > 0 && (
                        <tr>
                            <td style={{ height: virtualItems[0]?.start || 0, padding: 0, border: 0 }} colSpan={5} />
                        </tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                        const file = sortedFiles[virtualRow.index];
                        if (!file) return null;
                        const isSelected = selectedIdSet.has(file.id);
                        return (
                            <FileRow key={file.id} file={file} data-index={virtualRow.index}>
                                <Table.Td>
                                    <Checkbox 
                                        checked={isSelected}
                                        onChange={() => toggleFileSelection(file.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <Group gap="xs" wrap="nowrap">
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <Text size="sm" fw={500} style={{ wordBreak: 'break-all', cursor: 'pointer' }} onClick={() => setPreviewFileId(file.id)}>
                                                {file.name}
                                            </Text>
                                            {(file as any).snippet ? (
                                                <Text size="xs" c="dimmed" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <span dangerouslySetInnerHTML={{ __html: (file as any).snippet }} />
                                                </Text>
                                            ) : (
                                                <Text size="xs" c="dimmed" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {file.path}
                                                </Text>
                                            )}
                                        </div>
                                    </Group>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap={4} wrap="nowrap">
                                        <Tooltip label={t.openDirectory}>
                                            <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); openDirectory(file.id); }}>
                                                <IconFolder size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label={t.openFile}>
                                            <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); openFile(file.id); }}>
                                                <IconExternalLink size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap={5}>
                                    {file.tags.map((tag: any) => (
                                        <Badge 
                                        key={tag.id} 
                                        variant="light" 
                                        color={tag.color || 'appleBlue'}
                                        rightSection={
                                            <ActionIcon size="xs" color="gray" variant="transparent" onClick={(e) => { e.stopPropagation(); removeTagFromFile(file.id, tag.id); }}>
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
                            <td style={{ height: rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0), padding: 0, border: 0 }} colSpan={5} />
                        </tr>
                    )}
                    </>
                )}
                </Table.Tbody>
            </Table>
            
            {!isLoading && !isSearching && isReady && filteredFiles.length === 0 && (
                <Stack align="center" py="xl">
                <Text c="dimmed">{t.noFiles}</Text>
                </Stack>
            )}
            </div>
        </div>
    </div>
  );
}