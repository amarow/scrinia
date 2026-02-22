import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Title, 
  Text, 
  Table, 
  Group, 
  Badge, 
  TextInput, 
  Loader, 
  Center,
  Paper,
  Stack,
  ScrollArea,
  ActionIcon,
  useMantineColorScheme
} from '@mantine/core';
import { 
  IconSearch, 
  IconFile, 
  IconPhoto, 
  IconMusic, 
  IconVideo, 
  IconFileText, 
  IconFileZip, 
  IconFileTypePdf,
  IconClick,
  IconSun,
  IconMoon
} from '@tabler/icons-react';
import axios from 'axios';
import { FilePreview } from '../components/FilePreview';

interface SharedFile {
  hash: string;
  name: string;
  size: number;
  mimeType: string;
  tags: string[];
}

interface ShareData {
  name: string;
  files: SharedFile[];
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return <IconPhoto size={20} color="var(--mantine-color-blue-4)" />;
  if (mimeType.startsWith('audio/')) return <IconMusic size={20} color="var(--mantine-color-grape-4)" />;
  if (mimeType.startsWith('video/')) return <IconVideo size={20} color="var(--mantine-color-red-4)" />;
  if (mimeType === 'application/pdf') return <IconFileTypePdf size={20} color="var(--mantine-color-red-6)" />;
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return <IconFileText size={20} color="var(--mantine-color-gray-5)" />;
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar')) return <IconFileZip size={20} color="var(--mantine-color-yellow-6)" />;
  return <IconFile size={20} color="var(--mantine-color-gray-4)" />;
};

export default function ShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  
  // Preview State
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);

  useEffect(() => {
    async function fetchShare() {
      try {
        setLoading(true);
        const res = await axios.get(`/api/v1/pub/share/${token}`);
        setData(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Share konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    }
    fetchShare();
  }, [token]);

  // Extrahiere alle verfügbaren Tags aus allen Dateien
  const allTags = useMemo(() => {
    if (!data) return [];
    const tags = new Set<string>();
    data.files.forEach(f => f.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [data]);

  // Filter-Logik
  const filteredFiles = useMemo(() => {
    if (!data) return [];
    return data.files.filter(file => {
      const matchesSearch = file.name.toLowerCase().includes(search.toLowerCase());
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every(tag => file.tags?.includes(tag));
      return matchesSearch && matchesTags;
    });
  }, [data, search, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (loading) return <Center h="100vh"><Loader size="xl" /></Center>;
  if (error) return <Center h="100vh"><Paper p="xl" withBorder><Title order={3} c="red">Fehler</Title><Text>{error}</Text></Paper></Center>;
  if (!data) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header Area */}
        <Paper p="md" withBorder style={{ zIndex: 10, flexShrink: 0 }} radius={0}>
            <Group justify="space-between" align="center">
                <Group gap="xs" style={{ flex: 1, overflow: 'hidden' }}>
                    <IconFile size={24} style={{ opacity: 0.5, flexShrink: 0 }} />
                    <Title order={4} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</Title>
                    <Badge variant="light" color="gray" size="sm" style={{ flexShrink: 0 }}>{filteredFiles.length}</Badge>

                    {allTags.length > 0 && (
                        <Group gap={6} ml="md" style={{ flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
                            {allTags.map(tag => (
                                <Badge 
                                    key={tag} 
                                    size="sm"
                                    variant={selectedTags.includes(tag) ? "filled" : "outline"}
                                    style={{ cursor: 'pointer', flexShrink: 0 }}
                                    onClick={() => toggleTag(tag)}
                                >
                                    {tag}
                                </Badge>
                            ))}
                            {selectedTags.length > 0 && (
                                <ActionIcon variant="subtle" size="xs" color="gray" onClick={() => setSelectedTags([])}>
                                    <IconClick size={12} />
                                </ActionIcon>
                            )}
                        </Group>
                    )}
                </Group>
                
                <Group gap="xs">
                    <TextInput 
                        placeholder="Search..." 
                        leftSection={<IconSearch size={16} />}
                        size="xs"
                        style={{ width: 200 }}
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                    />
                    <ActionIcon onClick={toggleColorScheme} variant="default" size="input-xs">
                         {colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
                    </ActionIcon>
                </Group>
            </Group>
        </Paper>

        {/* Main Content: Split View */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* Left: List */}
            <div style={{ width: '400px', borderRight: '1px solid var(--mantine-color-default-border)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mantine-color-body)', flexShrink: 0 }}>
                 <ScrollArea style={{ flex: 1 }}>
                    <Table verticalSpacing="sm" highlightOnHover>
                        <Table.Tbody>
                            {filteredFiles.map(file => {
                                const isSelected = previewFile?.hash === file.hash;
                                return (
                                    <Table.Tr 
                                        key={file.hash} 
                                        onClick={() => setPreviewFile(file)}
                                        bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <Table.Td style={{ width: 40, paddingRight: 0 }}>
                                            <Center>
                                                {getFileIcon(file.mimeType)}
                                            </Center>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" fw={500} truncate>{file.name}</Text>
                                            <Group gap="xs">
                                                <Text size="xs" c="dimmed">{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
                                                {file.tags?.length > 0 && (
                                                    <Text size="xs" c="dimmed">• {file.tags.join(', ')}</Text>
                                                )}
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                            {filteredFiles.length === 0 && (
                                <Table.Tr>
                                    <Table.Td colSpan={2}>
                                        <Text ta="center" py="xl" c="dimmed" size="sm">No files found.</Text>
                                    </Table.Td>
                                </Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>
                 </ScrollArea>
                 <Paper p="xs" withBorder style={{ borderTop: '1px solid var(--mantine-color-default-border)', borderBottom: 0, borderLeft: 0, borderRight: 0, background: 'transparent' }}>
                     <Text size="xs" c="dimmed" ta="center">Powered by Scrinia</Text>
                 </Paper>
            </div>

            {/* Right: Preview */}
            <div style={{ flex: 1, padding: 'var(--mantine-spacing-md)', backgroundColor: 'var(--mantine-color-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                {previewFile && token ? (
                    <FilePreview 
                        file={previewFile} 
                        token={token} 
                        hideBack
                    />
                ) : (
                    <Center h="100%">
                        <Stack align="center" gap="xs">
                            <IconClick size={48} color="var(--mantine-color-gray-4)" />
                            <Text c="dimmed">Select a file to view preview</Text>
                        </Stack>
                    </Center>
                )}
            </div>
        </div>
    </div>
  );
}
