import { AppShell, Badge, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { SettingsPage } from './pages/Settings';
import { DataPage } from './pages/DataPage';
import { ContextExportPage } from './pages/ContextExport';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DataSidebar } from './components/DataSidebar';
import { Login } from './components/Login';
import { PrivacyRulesModal } from './components/settings/PrivacyRulesModal';

import { useShallow } from 'zustand/react/shallow';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const { 
    isAuthenticated, init, selectedFileIds, addTagToMultipleFiles, addTagToFile,
    activeMainTab 
  } = useAppStore(useShallow(state => ({
    isAuthenticated: state.isAuthenticated,
    init: state.init,
    selectedFileIds: state.selectedFileIds,
    addTagToMultipleFiles: state.addTagToMultipleFiles,
    addTagToFile: state.addTagToFile,
    activeMainTab: state.activeMainTab
  })));
  
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

    console.log('[DND] End:', { activeType, overType, activeId, overId });

    // RULESET TEXT DROP LOGIC (Add rule from selection)
    if (activeType === 'TEXT_SELECTION' && overType === 'RULESET_TARGET') {
        const text = active.data.current?.text;
        const profileId = overId;
        console.log('[DND] TEXT -> RULESET:', { text, profileId });
        if (text && profileId) {
            useAppStore.getState().addPrivacyRule(Number(profileId), {
                type: 'LITERAL',
                pattern: text,
                replacement: '[REDACTED]'
            });
            // Clear selection after drop
            window.getSelection()?.removeAllRanges();
            (window as any)._currentScriniaSelection = '';
            // We need to trigger a re-render for the 'hasSelection' state if possible, 
            // but for now the notification will show success.
        }
        return;
    }

    // DATA VIEW DND LOGIC
    if (overType === 'SHARE_TARGET') {
        const share = useAppStore.getState().shares.find(k => k.id === overId);
        if (!share) return;

        if (activeType === 'TAG') {
            const tagId = Number(activeId);
            const currentTags = share.tagIds || [];
            if (!currentTags.includes(tagId)) {
                const newTags = [...currentTags, tagId];
                useAppStore.getState().updateShare(share.id, { tagIds: newTags });
            }
        }

        if (activeType === 'RULESET') {
            const rulesetId = Number(activeId);
            const currentProfiles = share.privacyProfileIds || [];
            if (!currentProfiles.includes(rulesetId)) {
                const newProfiles = [...currentProfiles, rulesetId];
                useAppStore.getState().updateShare(share.id, { privacyProfileIds: newProfiles });
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
              <Route path="/data/share/:shareId" element={<DataPage />} />
              <Route path="/data/ruleset/:rulesetId" element={<DataPage />} />
              <Route path="/export/:shareId" element={<ContextExportPage />} />
          </Routes>
        </AppShell.Main>
        
        <PrivacyRulesModal />

        <DragOverlay>
          {activeDragItem ? (
             <Button 
               variant="filled" 
               size="xs" 
               color={activeDragItem.type === 'TEXT_SELECTION' ? 'blue' : undefined}
               style={{ cursor: 'grabbing', opacity: 0.9 }}
               rightSection={
                   (activeDragItem.type === 'FILE' && selectedFileIds.includes(activeDragItem.id) && selectedFileIds.length > 1) 
                   ? <Badge size="xs" circle color="white" c="appleBlue.6">{selectedFileIds.length}</Badge> 
                   : null
               }
             >
                {activeDragItem.type === 'TEXT_SELECTION' 
                    ? `Add Rule: ${activeDragItem.text.substring(0, 20)}${activeDragItem.text.length > 20 ? '...' : ''}` 
                    : activeDragItem.name}
             </Button>
          ) : null}
        </DragOverlay>
      </AppShell>
    </DndContext>
  );
}
