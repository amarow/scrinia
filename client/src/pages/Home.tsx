import { Group, Text, Loader, Alert, Stack, Badge, Table, ActionIcon, Button, Center, Checkbox } from '@mantine/core';
import { IconFiles, IconAlertCircle, IconX, IconSettings } from '@tabler/icons-react';
import { useState, useRef, useMemo } from 'react';
import { useAppStore } from '../store';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileRow } from '../components/DndComponents';
import { useNavigate } from 'react-router-dom';
import { translations } from '../i18n';

export function HomePage() {
  console.log("[HomePage] Render cycle start");
  const { 
    files, isLoading, error, 
    activeScopeIds, selectedTagId, searchQuery,
    selectedFileIds, toggleFileSelection, setFileSelection, clearFileSelection,
    removeTagFromFile, openFile, language
  } = useAppStore();

  const t = translations[language];
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const parentRef = useRef<HTMLDivElement>(null);

  const handleSort = (field: 'name' | 'size' | 'updatedAt') => {
      if (sortBy === field) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(field);
          setSortOrder('desc'); // Default to desc for new sort
      }
  };

  const filteredFiles = useMemo(() => {
    console.log(`[HomePage] Filtering ${files.length} files...`);
    const lowerQuery = searchQuery.toLowerCase();
    return files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(lowerQuery);
      const matchesScope = activeScopeIds.length > 0 ? activeScopeIds.includes(file.scopeId) : false;
      const matchesTag = selectedTagId ? file.tags.some((t: any) => t.id === selectedTagId) : true;
      return matchesSearch && matchesScope && matchesTag;
    });
  }, [files, searchQuery, activeScopeIds, selectedTagId]);

  const sortedFiles = useMemo(() => {
    console.log(`[HomePage] Sorting ${filteredFiles.length} files...`);
    return [...filteredFiles].sort((a, b) => {
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
                  <Button leftSection={<IconSettings size={16} />} onClick={() => navigate('/settings')}>
                      {t.settings}
                  </Button>
              </Stack>
          </Center>
      );
  }

  return (
    <>
        <Group mb="md" justify="space-between">
           <Group>
             <IconFiles size={20} />
             <Text fw={500}>
                {t.files} ({filteredFiles.length} / {files.length})
             </Text>
             {selectedFileIds.length > 0 && <Badge color="violet">{t.selected.replace('{count}', selectedFileIds.length.toString())}</Badge>}
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
                <Table.Th style={{ width: '40px' }}>
                    <Checkbox 
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected}
                        onChange={handleSelectAll}
                    />
                </Table.Th>
                <Table.Th style={{ cursor: 'pointer', width: '50%' }} onClick={() => handleSort('name')}>
                  {t.name} {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Table.Th>
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
               {isLoading && filteredFiles.length === 0 ? (
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
                                        <Text size="sm" fw={500} style={{ wordBreak: 'break-all', cursor: 'pointer' }} onClick={() => openFile(file.id)}>
                                            {file.name}
                                        </Text>
                                        <Text size="xs" c="dimmed" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.path}
                                        </Text>
                                    </div>
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
          
          {!isLoading && filteredFiles.length === 0 && (
            <Stack align="center" py="xl">
              <Text c="dimmed">{t.noFiles}</Text>
            </Stack>
          )}
        </div>
    </>
  );
}