import { useState, useEffect } from 'react';
import { Group, Stack, Text, Button, ActionIcon, Table, Switch, Modal, TextInput, Select } from '@mantine/core';
import { IconPlus, IconTrash, IconCopy } from '@tabler/icons-react';
import { useAppStore } from '../../store';
import { translations } from '../../i18n';

const PRESETS: Record<string, string> = {
    'EMAIL': '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    'IBAN': '[A-Z]{2}\\d{2}[A-Z0-9]{4}\\d{7}([A-Z0-9]?){0,16}',
    'IPV4': '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
    'PHONE': '(?:(?:phone|tel|mobile|mobil|telefon)\\s*[:\\-]?\\s*)(?:\\+?49|0)(?:\\s*\\d{2,5}\\s*)(?:\\d{3,9})'
};

export const PrivacyRulesModal = ({ onSaveSuccess }: { onSaveSuccess?: () => void }) => {
  const { 
    privacyProfiles, createPrivacyProfile, updatePrivacyProfile,
    fetchPrivacyRules, language, isLoading,
    editingRule, setEditingRule,
    isPrivacyModalOpen, setIsPrivacyModalOpen
  } = useAppStore();
  
  console.log('[PrivacyRulesModal] State:', { isPrivacyModalOpen, editingRule: !!editingRule });

  const t = translations[language];

  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [activeProfileName, setActiveProfileName] = useState('');
  const [rules, setRules] = useState<any[]>([]);

  // Synchronize local state with store when editingRule or modal visibility changes
  useEffect(() => {
    if (isPrivacyModalOpen && editingRule) {
        if (editingRule.isNew) {
            setRules(editingRule.initialRules || []);
            setActiveProfileId(null);
            setActiveProfileName(editingRule.initialName || '');
        } else if (editingRule.profileId) {
            const profile = privacyProfiles.find(p => p.id === editingRule.profileId);
            if (profile) {
                if (editingRule.initialRules) {
                    setRules(editingRule.initialRules);
                    setActiveProfileId(profile.id);
                    setActiveProfileName(profile.name);
                } else {
                    fetchPrivacyRules(profile.id).then(r => {
                        setRules(r);
                        setActiveProfileId(profile.id);
                        setActiveProfileName(profile.name);
                    });
                }
            }
        }
    } else if (!isPrivacyModalOpen) {
        // Reset local state when modal is closed
        setRules([]);
        setActiveProfileId(null);
        setActiveProfileName('');
    }
  }, [editingRule, isPrivacyModalOpen, privacyProfiles]);

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
      useAppStore.setState((state: any) => ({ privacyRefreshCounter: state.privacyRefreshCounter + 1 }));
      setIsPrivacyModalOpen(false);
      setEditingRule(null);
      notifications.show({
          title: t.save,
          message: 'Ruleset updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />
      });
      if (onSaveSuccess) onSaveSuccess();
  };

  return (
    <Modal 
          opened={isPrivacyModalOpen} 
          onClose={() => {
              setIsPrivacyModalOpen(false);
              setEditingRule(null);
          }} 
          title={t.anonymization}
          size="xl"
          zIndex={1000} // Ensure it's above the preview panel
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
                      {rules.map((rule, idx) => {
                          const isEditingThisOne = editingRule?.ruleId === rule.id;
                          return (
                          <tr 
                            key={rule.id || rule.tempId || idx}
                            style={isEditingThisOne ? { backgroundColor: 'rgba(34, 139, 230, 0.15)', outline: '2px solid #228be6' } : {}}
                          >
                              <td>
                                  <Select 
                                      size="xs"
                                      variant="unstyled"
                                      comboboxProps={{ zIndex: 2000 }}
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
                          );
                      })}
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
  );
};
