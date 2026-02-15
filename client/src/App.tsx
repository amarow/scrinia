import { AppShell, Badge, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragEndEvent } from '@dnd-kit/core';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/Home';
import { SettingsPage } from './pages/Settings';
import { ContextExportPage } from './pages/ContextExport';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { PrivacyRulesModal } from './components/settings/PrivacyRulesModal';

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const { 
    isAuthenticated, init, selectedFileIds, addTagToMultipleFiles, addTagToFile 
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
        padding="md"
      >
        <Header opened={opened} toggle={toggle} />
        <Sidebar />

        <AppShell.Main>
          <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/export/:keyId" element={<ContextExportPage />} />
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
