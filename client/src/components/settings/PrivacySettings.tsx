import { useState } from 'react';
import { Title, Card, Group, Stack, Text, Button, ActionIcon, Table, Switch, Modal, TextInput, Select } from '@mantine/core';
import { IconPlus, IconShieldLock, IconSettings, IconTrash, IconCopy } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';
import { modals } from '@mantine/modals';

const PRESETS: Record<string, string> = {
    'EMAIL': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    'IBAN': '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}',
    'IPV4': '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    'PHONE': '(?:\\+?49|0)(?:\\s*\\d{2,5}\\s*)(?:\\d{3,9})'
};

export const PrivacySettings = () => {
  const { 
    privacyProfiles, createPrivacyProfile, deletePrivacyProfile, updatePrivacyProfile,
    fetchPrivacyRules, language, isLoading 
  } = useAppStore();
  const t = translations[language];

  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeProfileName, setActiveProfileName] = useState('');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [rules, setRules] = useState<any[]>([]);

  const handleUpdateRuleLocal = (id: string | number, updates: any) => {
      setRules(prev => prev.map(r => (r.id === id || r.tempId === id) ? { ...r, ...updates } : r));
  };

  const handleAddEmptyRuleLocal = () => {
      setRules(prev => [...prev, {
          tempId: Date.now(),
          type: 'LITERAL',
          pattern: '',
          replacement: '[REDACTED]',
          isActive: true
      }]);
  };

  const handleCloneRuleLocal = (rule: any) => {
      setRules(prev => [...prev, {
          ...rule,
          id: undefined,
          tempId: Date.now(),
          pattern: `${rule.pattern} (Copy)`
      }]);
  };

  const handleRemoveRuleLocal = (id: string | number) => {
      setRules(prev => prev.filter(r => r.id !== id && r.tempId !== id));
  };

  const handleSave = async () => {
      if (activeProfileId) {
          await updatePrivacyProfile(activeProfileId, activeProfileName, rules);
      } else {
          await createPrivacyProfile(activeProfileName, rules);
      }
      setIsRulesModalOpen(false);
  };

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
                          setActiveProfileId(null);
                          setActiveProfileName(t.createProfile);
                          setRules([]);
                          setIsRulesModalOpen(true);
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
                                  // Clean rules for cloning (remove IDs so they are treated as new)
                                  const clonedRules = r.map(rule => ({ ...rule, id: undefined, tempId: Date.now() + Math.random() }));
                                  setRules(clonedRules);
                                  setActiveProfileId(null); // It's a new profile
                                  setActiveProfileName(`${profile.name} (Copy)`);
                                  setIsRulesModalOpen(true);
                              }}
                          >
                              <IconCopy size={16} />
                          </ActionIcon>
                          <ActionIcon 
                              variant="light" 
                              onClick={async () => {
                                  const r = await fetchPrivacyRules(profile.id);
                                  setRules(r);
                                  setActiveProfileId(profile.id);
                                  setActiveProfileName(profile.name);
                                  setIsRulesModalOpen(true);
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

      <Modal 
          opened={isRulesModalOpen} 
          onClose={() => setIsRulesModalOpen(false)} 
          title={t.anonymization}
          size="xl"
      >
          <Stack>
              <TextInput 
                  label={t.profileName}
                  placeholder="e.g. My Privacy Rules"
                  value={activeProfileName}
                  onChange={(e) => setActiveProfileName(e.currentTarget.value)}
              />

              <Group justify="space-between" align="center" mt="md">
                  <Text fw={500} size="sm">{t.rules}</Text>
                  <Button 
                      size="xs" 
                      variant="light" 
                      leftSection={<IconPlus size={14} />}
                      onClick={handleAddEmptyRuleLocal}
                  >
                      {t.add}
                  </Button>
              </Group>

              <Table striped highlightOnHover withTableBorder mt="xs">
                  <thead>
                      <tr>
                          <th style={{ width: 120, textAlign: 'left' }}>{t.type}</th>
                          <th style={{ textAlign: 'left' }}>{t.pattern}</th>
                          <th style={{ width: 150, textAlign: 'left' }}>{t.replacement}</th>
                          <th style={{ width: 60, textAlign: 'left' }}>{t.active}</th>
                          <th style={{ width: 90 }}></th>
                      </tr>
                  </thead>
                  <tbody>
                      {rules.map((rule, idx) => (
                          <tr key={rule.id || rule.tempId || idx}>
                              <td>
                                  <Select 
                                      size="xs"
                                      variant="unstyled"
                                      data={[
                                          { value: 'LITERAL', label: t.literal },
                                          { value: 'REGEX', label: t.regex },
                                          { value: 'EMAIL', label: t.email },
                                          { value: 'IBAN', label: t.iban },
                                          { value: 'IPV4', label: t.ipv4 },
                                          { value: 'PHONE', label: t.phone }
                                      ]}
                                      value={rule.type}
                                      onChange={(val) => {
                                          const updates: any = { type: val };
                                          if (val && PRESETS[val] && !rule.pattern) {
                                              updates.pattern = PRESETS[val];
                                          }
                                          handleUpdateRuleLocal(rule.id || rule.tempId, updates);
                                      }}
                                  />
                              </td>
                              <td>
                                  <TextInput 
                                      size="xs"
                                      variant="unstyled"
                                      value={rule.pattern}
                                      placeholder={t.pattern}
                                      onChange={(e) => handleUpdateRuleLocal(rule.id || rule.tempId, { pattern: e.currentTarget.value })}
                                      styles={{ input: { fontFamily: 'monospace' } }}
                                  />
                              </td>
                              <td>
                                  <TextInput 
                                      size="xs"
                                      variant="unstyled"
                                      value={rule.replacement}
                                      placeholder={t.replacement}
                                      onChange={(e) => handleUpdateRuleLocal(rule.id || rule.tempId, { replacement: e.currentTarget.value })}
                                  />
                              </td>
                              <td style={{ textAlign: 'left' }}>
                                  <Switch 
                                      checked={!!rule.isActive}
                                      onChange={(e) => handleUpdateRuleLocal(rule.id || rule.tempId, { isActive: e.currentTarget.checked })}
                                      size="xs"
                                  />
                              </td>
                              <td>
                                  <Group gap={4} wrap="nowrap">
                                      <ActionIcon 
                                          variant="subtle" 
                                          color="blue" 
                                          size="sm"
                                          onClick={() => handleCloneRuleLocal(rule)}
                                      >
                                          <IconCopy size={14} />
                                      </ActionIcon>
                                      <ActionIcon 
                                          variant="subtle" 
                                          color="red" 
                                          size="sm"
                                          onClick={() => handleRemoveRuleLocal(rule.id || rule.tempId)}
                                      >
                                          <IconTrash size={14} />
                                      </ActionIcon>
                                  </Group>
                              </td>
                          </tr>
                      ))}
                      {rules.length === 0 && (
                          <tr>
                              <td colSpan={5}>
                                  <Text size="xs" c="dimmed" ta="center" py="sm">No rules defined yet.</Text>
                              </td>
                          </tr>
                      )}
                  </tbody>
              </Table>
              
              <Button 
                  mt="xl" 
                  onClick={handleSave} 
                  loading={isLoading}
                  disabled={!activeProfileName.trim()}
              >
                  {t.save}
              </Button>
          </Stack>
      </Modal>
    </>
  );
};
