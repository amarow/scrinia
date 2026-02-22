import { useState, useEffect } from 'react';
import { 
  Paper, Group, Button, Text, Loader, Code, Center, Image, Stack, ActionIcon, Tooltip
} from '@mantine/core';
import { IconDownload, IconArrowLeft, IconFileUnknown } from '@tabler/icons-react';
import axios from 'axios';

interface SharedFile {
  hash: string;
  name: string;
  size: number;
  mimeType: string;
  tags: string[];
}

interface FilePreviewProps {
  file: SharedFile;
  token: string;
  onBack?: () => void;
  hideBack?: boolean;
}

export function FilePreview({ file, token, onBack, hideBack = false }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadUrl = `/api/v1/pub/share/${token}/download/${file.hash}`;

  useEffect(() => {
    // Only fetch text content
    if (file.mimeType.startsWith('text/') || file.mimeType.includes('json') || file.mimeType.includes('xml') || file.mimeType.includes('javascript') || file.mimeType.includes('typescript')) {
      setLoading(true);
      axios.get(downloadUrl, { responseType: 'text' })
        .then(res => setContent(res.data))
        .catch(() => setError('Konnte Dateiinhalt nicht laden.'))
        .finally(() => setLoading(false));
    } else {
        setContent(null);
    }
  }, [file, downloadUrl]);

  const renderContent = () => {
    if (loading) return <Center h="100%"><Loader /></Center>;
    if (error) return <Center h="100%"><Text c="red">{error}</Text></Center>;

    if (file.mimeType.startsWith('image/')) {
      return (
        <Center style={{ backgroundColor: 'var(--mantine-color-gray-1)', borderRadius: 8, flex: 1, height: '100%', overflow: 'hidden' }}>
            <Image src={downloadUrl} fit="contain" style={{ maxHeight: '100%', maxWidth: '100%' }} />
        </Center>
      );
    }

    if (file.mimeType.startsWith('video/')) {
        return (
            <Center style={{ backgroundColor: '#000', borderRadius: 8, flex: 1, height: '100%' }}>
                <video controls src={downloadUrl} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </Center>
        );
    }
    
    if (file.mimeType.startsWith('audio/')) {
        return (
            <Center style={{ backgroundColor: 'var(--mantine-color-gray-1)', borderRadius: 8, flex: 1, height: '100%' }}>
                <audio controls src={downloadUrl} />
            </Center>
        );
    }

    if (file.mimeType === 'application/pdf') {
         return (
             <iframe src={downloadUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} />
         );
    }

    if (content !== null) {
      return (
        <Paper p="md" withBorder bg="var(--mantine-color-body)" style={{ overflow: 'auto', flex: 1, height: '100%' }}>
          <Code block>{content}</Code>
        </Paper>
      );
    }

    return (
      <Center h="100%" style={{ flexDirection: 'column', gap: 16 }}>
        <IconFileUnknown size={64} color="gray" />
        <Text>Vorschau für diesen Dateityp nicht verfügbar.</Text>
      </Center>
    );
  };

  return (
    <Stack gap="xs" h="100%" style={{ overflow: 'hidden' }}>
      <Group justify="space-between" align="center" style={{ flexShrink: 0, minHeight: 36 }}>
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
            {!hideBack && onBack && (
                <ActionIcon variant="subtle" onClick={onBack} size="sm">
                    <IconArrowLeft size={16} />
                </ActionIcon>
            )}
            <Text fw={700} size="sm" truncate>{file.name}</Text>
        </Group>
        <Tooltip label="Download">
            <Button 
                component="a" 
                href={downloadUrl} 
                variant="light" 
                size="xs" 
                leftSection={<IconDownload size={14} />}
            >
                Download
            </Button>
        </Tooltip>
      </Group>
      
      <Paper shadow="sm" radius="md" p={0} withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderContent()}
      </Paper>
    </Stack>
  );
}
