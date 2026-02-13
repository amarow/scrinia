import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import App from './App.tsx'

// Define the "Apple-like" palette
const theme = createTheme({
  colors: {
    appleBlue: [
      '#eef3ff', // 0
      '#dce4f5', // 1
      '#b9c7e2', // 2
      '#94a8d0', // 3
      '#748dc1', // 4
      '#5f7cb8', // 5
      '#5474b4', // 6
      '#44639f', // 7
      '#39588f', // 8
      '#2d4b82', // 9
    ],
  },
  primaryColor: 'appleBlue',
  defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  components: {
    Button: { defaultProps: { fw: 500 } },
    ActionIcon: { defaultProps: { variant: 'subtle' } },
    Card: { defaultProps: { withBorder: true, shadow: 'sm', radius: 'md' } },
    NavLink: { defaultProps: { variant: 'subtle' } },
  },
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

import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications position="top-right" zIndex={2000} />
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
