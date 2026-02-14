import { useState, useEffect } from 'react';
import { Title, Card, Group, Stack, Text, Button, ActionIcon, Badge, Modal, TextInput, MultiSelect } from '@mantine/core';
import { IconPlus, IconKey, IconShieldLock, IconSettings, IconTrash, IconCopy, IconCheck } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

export const ApiKeySettings = () => {
  const { 
    apiKeys, fetchApiKeys, createApiKey, deleteApiKey, updateApiKey, 
    generateApiKeyString, tags, privacyProfiles, language, isLoading 
  } = useAppStore();
  const t = translations[language];

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedTagsForKey, setSelectedTagsForKey] = useState<string[]>([]);
  const [selectedPrivacyProfiles, setSelectedPrivacyProfiles] = useState<string[]>([]);
  const [existingKeyString, setExistingKeyString] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleSave = async () => {
      const perms = selectedTagsForKey.length > 0 
          ? selectedTagsForKey.map(id => `tag:${id}`).join(',')
          : 'files:read,tags:read';
      const profileIds = selectedPrivacyProfiles.map(id => parseInt(id));
      
      if (editingKeyId) {
          await updateApiKey(editingKeyId, { 
              name: newKeyName, 
              permissions: perms as any, 
              privacyProfileIds: profileIds 
          });
      } else {
          await createApiKey(newKeyName, perms, profileIds, existingKeyString || undefined);
      }
      setIsKeyModalOpen(false);
  };

  return (
    <>
      <Title order={3} mb="md">{t.apiKeys}</Title>
      <Card withBorder shadow="sm" radius="md" mb="xl">
          <Card.Section withBorder inheritPadding py="xs">
              <Group justify="space-between">
                  <Stack gap={0}>
                      <Text fw={500}>{t.apiKeys}</Text>
                      <Text size="xs" c="dimmed">{t.apiKeysDesc}</Text>
                  </Stack>
                  <Button 
                      leftSection={<IconPlus size={16} />} 
                      variant="light" 
                      size="xs" 
                      onClick={async () => {
                          const preGeneratedKey = await generateApiKeyString();
                          setEditingKeyId(null);
                          setNewKeyName(t.keyName);
                          setSelectedTagsForKey([]);
                          setSelectedPrivacyProfiles([]);
                          setExistingKeyString(preGeneratedKey);
                          setIsKeyModalOpen(true);
                      }}
                      loading={isLoading}
                  >
                      {t.add}
                  </Button>
              </Group>
          </Card.Section>

          <Stack gap="xs" mt="md">
              {apiKeys.length === 0 && (
                  <Text c="dimmed" ta="center" py="md">No API keys created yet.</Text>
              )}
              
              {apiKeys.map(key => (
                  <Group key={key.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px' }}>
                      <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                              <IconKey size={20} color="gray" />
                              <Text size="sm" fw={500}>{key.name}</Text>
                          </Group>
                          <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                  {t.lastUsed}: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : t.never}
                              </Text>
                              <Text size="xs" c="dimmed" style={{ borderLeft: '1px solid gray', paddingLeft: '8px' }}>
                                  {key.permissions.map(p => {
                                      if (p.startsWith('tag:')) {
                                          const id = parseInt(p.split(':')[1]);
                                          const tag = tags.find(t => t.id === id);
                                          return tag ? tag.name : p;
                                      }
                                      return p;
                                  }).join(', ')}
                              </Text>
                              {key.privacyProfileIds && key.privacyProfileIds.length > 0 && (
                                  <Group gap={4}>
                                      {key.privacyProfileIds.map(pid => {
                                          const profile = privacyProfiles.find(p => p.id === pid);
                                          return profile ? (
                                              <Badge key={pid} variant="outline" size="xs" color="blue" leftSection={<IconShieldLock size={10} />}>
                                                  {profile.name}
                                              </Badge>
                                          ) : null;
                                      })}
                                  </Group>
                              )}
                          </Group>
                      </Stack>
                      <Group gap="xs">
                          <ActionIcon 
                              variant="light" 
                              color="blue"
                              onClick={async () => {
                                  const preGeneratedKey = await generateApiKeyString();
                                  setEditingKeyId(null);
                                  setNewKeyName(`${key.name} (Copy)`);
                                  setSelectedTagsForKey(key.permissions.filter(p => p.startsWith('tag:')).map(p => p.split(':')[1]));
                                  setSelectedPrivacyProfiles(key.privacyProfileIds ? key.privacyProfileIds.map(String) : []);
                                  setExistingKeyString(preGeneratedKey);
                                  setIsKeyModalOpen(true);
                              }}
                          >
                              <IconCopy size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              onClick={() => {
                                  setEditingKeyId(key.id);
                                  setNewKeyName(key.name);
                                  setSelectedTagsForKey(key.permissions.filter(p => p.startsWith('tag:')).map(p => p.split(':')[1]));
                                  setSelectedPrivacyProfiles(key.privacyProfileIds ? key.privacyProfileIds.map(String) : []);
                                  setExistingKeyString(key.key || null);
                                  setIsKeyModalOpen(true);
                              }}
                          >
                              <IconSettings size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              color="red"
                              onClick={() => { 
                                  modals.openConfirmModal({
                                      title: t.deleteKeyTitle,
                                      children: <Text size="sm">{t.areYouSure}</Text>,
                                      labels: { confirm: t.delete, cancel: t.cancel },
                                      confirmProps: { color: 'red' },
                                      onConfirm: () => deleteApiKey(key.id),
                                  });
                              }}
                          >
                              <IconTrash size={16} />
                          </ActionIcon>
                      </Group>
                  </Group>
              ))}
          </Stack>
      </Card>

      <Modal 
          opened={isKeyModalOpen} 
          onClose={() => setIsKeyModalOpen(false)} 
          title={t.apiKey}
      >
          <Stack>
              {existingKeyString && (
                  <Group gap="xs">
                      <TextInput 
                          label="API Key"
                          value={existingKeyString} 
                          readOnly 
                          style={{ flex: 1 }}
                          styles={{ input: { fontFamily: 'monospace', fontSize: '12px' } }}
                      />
                      <ActionIcon 
                          size="lg" 
                          variant="light"
                          mt={24}
                          onClick={() => {
                              navigator.clipboard.writeText(existingKeyString);
                              notifications.show({
                                  title: t.copied,
                                  message: '',
                                  color: 'green',
                                  icon: <IconCheck size={16} />
                              });
                          }}
                      >
                          <IconCopy size={20} />
                      </ActionIcon>
                  </Group>
              )}
              <TextInput 
                  label={t.keyName} 
                  placeholder="e.g. Home Automation"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.currentTarget.value)}
                  autoFocus
              />
              <MultiSelect 
                  label={t.tags}
                  placeholder="Select tags this key can access"
                  data={tags.map(t => ({ value: String(t.id), label: t.name }))}
                  value={selectedTagsForKey}
                  onChange={setSelectedTagsForKey}
              />
              <MultiSelect 
                  label={t.anonymization}
                  placeholder={t.noProfile}
                  data={privacyProfiles.map(p => ({ value: String(p.id), label: p.name }))}
                  value={selectedPrivacyProfiles}
                  onChange={setSelectedPrivacyProfiles}
              />
              <Button 
                  onClick={handleSave}
                  disabled={!newKeyName}
                  loading={isLoading}
              >
                  {t.save}
              </Button>
          </Stack>
      </Modal>
    </>
  );
};
