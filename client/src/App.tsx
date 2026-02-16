import { AppShell, Badge, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { SettingsPage } from './pages/Settings';
import { DataPage } from './pages/DataPage';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DataSidebar } from './components/DataSidebar';
import { Login } from './components/Login';
import { PrivacyRulesModal } from './components/settings/PrivacyRulesModal';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const { 
    isAuthenticated, init, selectedFileIds, addTagToMultipleFiles, addTagToFile,
    activeMainTab 
  } = useAppStore();
  
  const [activeDragItem, setActiveDragItem] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (isAuthenticated) {
        init();
    }
  }, [isAuthenticated]);

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    const activeId = active.data.current?.id;
    const overId = over.data.current?.id;

    // DATA VIEW DND LOGIC
    if (overType === 'API_KEY_TARGET') {
        const apiKey = useAppStore.getState().apiKeys.find(k => k.id === overId);
        if (!apiKey) return;

        if (activeType === 'TAG') {
            const tagId = activeId;
            const currentTags = apiKey.permissions.filter(p => p.startsWith('tag:')).map(p => p.split(':')[1]);
            if (!currentTags.includes(String(tagId))) {
                const newPerms = [...apiKey.permissions, `tag:${tagId}`].join(',');
                // No need to update store yet, ApiKeyDetail will handle its own state
                // But we need a way to tell the component. For now, we update the store.
                useAppStore.getState().updateApiKey(apiKey.id, { permissions: newPerms as any });
            }
        }

        if (activeType === 'RULESET') {
            const rulesetId = activeId;
            const currentProfiles = apiKey.privacyProfileIds || [];
            if (!currentProfiles.includes(Number(rulesetId))) {
                const newProfiles = [...currentProfiles, Number(rulesetId)];
                useAppStore.getState().updateApiKey(apiKey.id, { privacyProfileIds: newProfiles });
            }
        }
        return;
    }

    // FILTER VIEW DND LOGIC
    if (activeType === 'TAG' && overType === 'FILE_TARGET') {
        const tagName = active.data.current?.name;
        if (tagName && overId) {
             if (selectedFileIds.includes(overId)) {
                 addTagToMultipleFiles(selectedFileIds, tagName);
             } else {
                 addTagToFile(overId, tagName);
             }
        }
    }

    if (activeType === 'FILE' && overType === 'TAG_TARGET') {
        const tagName = over.data.current?.name;
        if (tagName && activeId) {
             if (selectedFileIds.includes(activeId)) {
                 addTagToMultipleFiles(selectedFileIds, tagName);
             } else {
                 addTagToFile(activeId, tagName);
             }
        }
    }
  };

  if (!isAuthenticated) {
      return <Login />;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 300,
          breakpoint: 'sm',
          collapsed: { mobile: !opened },
        }}
        padding={0}
      >
        <Header opened={opened} toggle={toggle} />
        
        <AppShell.Navbar>
          {activeMainTab === 'filter' ? <Sidebar /> : <DataSidebar />}
        </AppShell.Navbar>

        <AppShell.Main>
          <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/data/key/:keyId" element={<DataPage />} />
              <Route path="/data/ruleset/:rulesetId" element={<DataPage />} />
          </Routes>
        </AppShell.Main>
        
        <PrivacyRulesModal />

        <DragOverlay>
          {activeDragItem ? (
             <Button 
               variant="filled" 
               size="xs" 
               style={{ cursor: 'grabbing', opacity: 0.9 }}
               rightSection={
                   (activeDragItem.type === 'FILE' && selectedFileIds.includes(activeDragItem.id) && selectedFileIds.length > 1) 
                   ? <Badge size="xs" circle color="white" c="appleBlue.6">{selectedFileIds.length}</Badge> 
                   : null
               }
             >
                {activeDragItem.name}
             </Button>
          ) : null}
        </DragOverlay>
      </AppShell>
    </DndContext>
  );
}
