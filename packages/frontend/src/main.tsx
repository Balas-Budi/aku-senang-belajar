import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';

const queryClient = new QueryClient();
const container = document.getElementById('root');

if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter />
        </QueryClientProvider>
    </React.StrictMode>,
);
