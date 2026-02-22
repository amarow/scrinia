import '@mantine/core/styles.css';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ShareView from './pages/ShareView';

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Inter, sans-serif',
});

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <BrowserRouter>
        <Routes>
          <Route path="/s/:token" element={<ShareView />} />
          <Route path="*" element={
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h1>Scrinia Relay</h1>
              <p>Bitte nutzen Sie einen gültigen Share-Link.</p>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
