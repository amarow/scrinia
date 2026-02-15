import { Title, Card, Group, Stack, Text, Button, ActionIcon } from '@mantine/core';
import { IconPlus, IconShieldLock, IconSettings, IconTrash, IconCopy } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';
import { modals } from '@mantine/modals';
import { PrivacyRulesModal } from './PrivacyRulesModal';

export const PrivacySettings = () => {
  const { 
    privacyProfiles, deletePrivacyProfile,
    fetchPrivacyRules, language, setEditingRule, setIsPrivacyModalOpen
  } = useAppStore();
  const t = translations[language];

  return (
    <>
      <Title order={3} mb="md">{t.privacy}</Title>
      <Card withBorder shadow="sm" radius="md" mb="xl">
          <Card.Section withBorder inheritPadding py="xs">
              <Group justify="space-between">
                  <Stack gap={0}>
                      <Text fw={500}>{t.privacy}</Text>
                      <Text size="xs" c="dimmed">{t.privacyDesc}</Text>
                  </Stack>
                  <Button 
                      leftSection={<IconPlus size={16} />} 
                      variant="light" 
                      size="xs" 
                      onClick={() => {
                          setEditingRule({ isNew: true, initialName: t.createProfile, initialRules: [] });
                          setIsPrivacyModalOpen(true);
                      }}
                  >
                      {t.add}
                  </Button>
              </Group>
          </Card.Section>

          <Stack gap="xs" mt="md">
              {privacyProfiles.length === 0 && (
                  <Text c="dimmed" ta="center" py="md">No privacy profiles created yet.</Text>
              )}
              
              {privacyProfiles.map(profile => (
                  <Group key={profile.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: '4px' }}>
                      <Group>
                          <IconShieldLock size={20} color="gray" />
                          <div>
                              <Text size="sm" fw={500}>{profile.name}</Text>
                              <Text size="xs" c="dimmed">{profile.ruleCount} {t.rules}</Text>
                          </div>
                      </Group>
                      <Group gap="xs">
                          <ActionIcon 
                              variant="light" 
                              color="blue"
                              onClick={async () => {
                                  const r = await fetchPrivacyRules(profile.id);
                                  const clonedRules = r.map((rule: any) => ({ ...rule, id: undefined, tempId: Date.now() + Math.random() }));
                                  setEditingRule({ 
                                      isNew: true, 
                                      initialName: `${profile.name} (Copy)`, 
                                      initialRules: clonedRules 
                                  });
                                  setIsPrivacyModalOpen(true);
                              }}
                          >
                              <IconCopy size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              onClick={() => {
                                  setEditingRule({ profileId: profile.id });
                                  setIsPrivacyModalOpen(true);
                              }}
                          >
                              <IconSettings size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              color="red"
                              onClick={() => { 
                                  modals.openConfirmModal({
                                      title: t.deleteProfileTitle,
                                      children: <Text size="sm">{t.areYouSure}</Text>,
                                      labels: { confirm: t.delete, cancel: t.cancel },
                                      confirmProps: { color: 'red' },
                                      onConfirm: () => deletePrivacyProfile(profile.id),
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

      <PrivacyRulesModal />
    </>
  );
};
