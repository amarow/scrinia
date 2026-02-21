import { useState, useEffect } from 'react';
import { Group, Stack, Text, Button, ActionIcon, Table, Switch, TextInput, Select, Paper, Title, Divider, Textarea, Grid, Badge } from '@mantine/core';
import { IconPlus, IconTrash, IconCopy, IconShieldLock, IconPlayerPlay, IconCheck } from '@tabler/icons-react';
import { useAppStore } from '../store';
import { translations } from '../i18n';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { authFetch, API_BASE } from '../store/utils';

import { useNavigate, useLocation } from 'react-router-dom';

const PRESETS: Record<string, string> = {
    'EMAIL': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    'IBAN': '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}',
    'IPV4': '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    'PHONE': '(?:(?:phone|tel|mobile|mobil|telefon)\\s*[:\\-]?\\s*)(?:\\+?49|0)(?:\\s*\\d{2,5}\\s*)(?:\\d{3,9})'
};

export const RulesetDetail = ({ profileId }: { profileId: number }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    privacyProfiles, updatePrivacyProfile, fetchPrivacyRules, language, isLoading, token
  } = useAppStore();
  const t = translations[language];

  const queryParams = new URLSearchParams(location.search);
  const highlightedRuleId = queryParams.get('ruleId');

  const [activeProfileName, setActiveProfileName] = useState('');
  const [rules, setRules] = useState<any[]>([]);

  const profile = privacyProfiles.find(p => p.id === profileId);

  useEffect(() => {
    if (profile) {
      setActiveProfileName(profile.name);
      fetchPrivacyRules(profile.id).then(setRules);
    }
  }, [profileId, privacyProfiles]);

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
      await updatePrivacyProfile(profileId, activeProfileName, rules);
      notifications.show({
          title: t.save,
          message: 'Ruleset updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />
      });
  };

  const handleDelete = () => {
    modals.openConfirmModal({
        title: t.deleteProfileTitle,
        children: <Text size="sm">{t.areYouSure}</Text>,
        labels: { confirm: t.delete, cancel: t.cancel },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
            const { deletePrivacyProfile } = useAppStore.getState();
            await deletePrivacyProfile(profileId);
            navigate('/data');
        },
    });
  };

  if (!profile) return <Text>Ruleset not found</Text>;

  return (
    <Stack gap="xl">
        <Group justify="space-between">
            <Group gap="xs">
                <IconShieldLock size={28} color="var(--mantine-color-green-filled)" />
                <div>
                    <Title order={2}>{t.privacyProfile}</Title>
                    <Text size="xs" c="dimmed">{t.privacyDesc}</Text>
                </div>
            </Group>
            <Group gap="xs">
                <Button 
                    onClick={handleSave} 
                    loading={isLoading}
                    leftSection={<IconCheck size={18} />}
                >
                    {t.save}
                </Button>
                <ActionIcon 
                    variant="light" 
                    color="red" 
                    size="lg"
                    onClick={handleDelete}
                >
                    <IconTrash size={22} />
                </ActionIcon>
            </Group>
        </Group>

        <Paper withBorder p="md" radius="md">
            <Stack gap="md">
                <TextInput 
                    label={t.profileName}
                    size="md"
                    placeholder="e.g. My Privacy Rules"
                    value={activeProfileName}
                    onChange={(e) => setActiveProfileName(e.currentTarget.value)}
                />

                <Divider label={t.rules} labelPosition="center" />

                <Table striped highlightOnHover withTableBorder>
                    <thead>
                        <tr>
                            <th style={{ width: 140, textAlign: 'left' }}>{t.type}</th>
                            <th style={{ textAlign: 'left' }}>{t.pattern}</th>
                            <th style={{ width: 180, textAlign: 'left' }}>{t.replacement}</th>
                            <th style={{ width: 80, textAlign: 'left' }}>{t.active}</th>
                            <th style={{ width: 100, textAlign: 'left' }}>
                                <Button 
                                    size="compact-xs" 
                                    variant="light" 
                                    leftSection={<IconPlus size={12} />}
                                    onClick={handleAddEmptyRuleLocal}
                                >
                                    {t.add}
                                </Button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map((rule, idx) => {
                            const isHighlighted = highlightedRuleId === rule.id?.toString();
                            return (
                            <tr 
                                key={rule.id || rule.tempId || idx}
                                style={isHighlighted ? { backgroundColor: 'rgba(34, 139, 230, 0.15)', outline: '2px solid #228be6' } : {}}
                            >
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
                                <td>
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
                            );
                        })}
                        {rules.length === 0 && (
                            <tr>
                                <td colSpan={5}>
                                    <Text size="xs" c="dimmed" ta="center" py="md">No rules defined yet.</Text>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Stack>
        </Paper>
    </Stack>
  );
};
