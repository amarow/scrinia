import { useState, useEffect } from 'react';
import { Title, Card, Group, Stack, Text, Button, ActionIcon, Badge, Modal, TextInput, MultiSelect } from '@mantine/core';
import { IconPlus, IconKey, IconShieldLock, IconSettings, IconTrash, IconCopy, IconCheck, IconFlask } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { useState, useEffect } from 'react';
import { Title, Card, Group, Stack, Text, Button, ActionIcon, Badge, Modal, TextInput, MultiSelect, Switch } from '@mantine/core';
import { IconPlus, IconShare, IconShieldLock, IconSettings, IconTrash, IconCopy, IconCheck, IconFlask, IconCloudCheck, IconCloudX } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

export const ShareSettings = () => {
  const navigate = useNavigate();
  const { 
    shares, fetchShares, createShare, deleteShare, updateShare, 
    generateShareKeyString, tags, privacyProfiles, language, isLoading 
  } = useAppStore();
  const t = translations[language];

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedTagsForKey, setSelectedTagsForKey] = useState<string[]>([]);
  const [selectedPrivacyProfiles, setSelectedPrivacyProfiles] = useState<string[]>([]);
  const [cloudSync, setCloudSync] = useState(false);
  const [existingKeyString, setExistingKeyString] = useState<string | null>(null);

  useEffect(() => {
    fetchShares();
  }, []);

  const handleSave = async () => {
      const tagIds = selectedTagsForKey.map(id => parseInt(id));
      const profileIds = selectedPrivacyProfiles.map(id => parseInt(id));
      
      if (editingKeyId) {
          await updateShare(editingKeyId, { 
              name: newKeyName, 
              tagIds, 
              privacyProfileIds: profileIds,
              cloudSync
          });
      } else {
          await createShare(newKeyName, 'all', tagIds, profileIds, existingKeyString || undefined);
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
                          const preGeneratedKey = await generateShareKeyString();
                          setEditingKeyId(null);
                          setNewKeyName(t.keyName);
                          setSelectedTagsForKey([]);
                          setSelectedPrivacyProfiles([]);
                          setCloudSync(false);
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
              {shares.length === 0 && (
                  <Text c="dimmed" ta="center" py="md">No shares created yet.</Text>
              )}
              
              {shares.map(share => (
                  <Group key={share.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px' }}>
                      <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                              <IconShare size={20} color="gray" />
                              <Text size="sm" fw={500}>{share.name}</Text>
                              {share.cloudSync && (
                                  <Badge size="xs" color="teal" variant="light" leftSection={<IconCloudCheck size={10} />}>
                                      Relay Sync
                                  </Badge>
                              )}
                          </Group>
                          <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                  {t.lastUsed}: {share.lastUsedAt ? new Date(share.lastUsedAt).toLocaleString() : t.never}
                              </Text>
                              <Group gap={4}>
                                  {share.tagIds && share.tagIds.length > 0 ? (
                                      share.tagIds.map(tid => {
                                          const tag = tags.find(tg => tg.id === tid);
                                          return tag ? (
                                              <Badge key={tid} size="xs" variant="dot" color={tag.color || 'blue'}>{tag.name}</Badge>
                                          ) : null;
                                      })
                                  ) : (
                                      <Text size="xs" c="dimmed">{t.files}</Text>
                                  )}
                              </Group>
                              {share.privacyProfileIds && share.privacyProfileIds.length > 0 && (
                                  <Group gap={4}>
                                      {share.privacyProfileIds.map(pid => {
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
                              color="green"
                              title="Test Context Export"
                              onClick={() => navigate(`/export/${share.id}`)}
                          >
                              <IconFlask size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              color="blue"
                              onClick={async () => {
                                  const preGeneratedKey = await generateShareKeyString();
                                  setEditingKeyId(null);
                                  setNewKeyName(`${share.name} (Copy)`);
                                  setSelectedTagsForKey(share.tagIds ? share.tagIds.map(String) : []);
                                  setSelectedPrivacyProfiles(share.privacyProfileIds ? share.privacyProfileIds.map(String) : []);
                                  setCloudSync(share.cloudSync);
                                  setExistingKeyString(preGeneratedKey);
                                  setIsKeyModalOpen(true);
                              }}
                          >
                              <IconCopy size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              onClick={() => {
                                  setEditingKeyId(share.id);
                                  setNewKeyName(share.name);
                                  setSelectedTagsForKey(share.tagIds ? share.tagIds.map(String) : []);
                                  setSelectedPrivacyProfiles(share.privacyProfileIds ? share.privacyProfileIds.map(String) : []);
                                  setCloudSync(share.cloudSync);
                                  setExistingKeyString(share.key || null);
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
                                      onConfirm: () => deleteShare(share.id),
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
                          label="Share Link Key"
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
                  placeholder="e.g. Mathe 10b"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.currentTarget.value)}
                  autoFocus
              />
              <MultiSelect 
                  label={t.tags}
                  placeholder="Select tags to share"
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
              <Switch 
                  label={t.cloudSync}
                  checked={cloudSync}
                  onChange={(e) => setCloudSync(e.currentTarget.checked)}
                  thumbIcon={cloudSync ? <IconCloudCheck size={12} /> : <IconCloudX size={12} />}
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
