import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css';
import { MantineProvider, createTheme } from '@mantine/core';
import App from './App.tsx'

// Define the "Godzilla Green" palette (Emerald-ish)
const theme = createTheme({
  colors: {
    godzilla: [
      '#ecfdf5', // 0
      '#d1fae5', // 1
      '#a7f3d0', // 2
      '#6ee7b7', // 3
      '#34d399', // 4
      '#10b981', // 5
      '#059669', // 6
      '#047857', // 7
      '#065f46', // 8
      '#064e3b', // 9
    ],
  },
  primaryColor: 'godzilla',
  defaultRadius: 'md',
});

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 20 }}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error?.toString()}</pre>
      </div>;
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>,
)
