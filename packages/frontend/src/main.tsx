import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { BrowserRouter, Routes, Route, Link } from 'react-router';
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query';

const queryClient = new QueryClient();

function Home() {
    const health = useQuery({
        queryKey: ['health'],
        queryFn: async () => {
            const response = await fetch('/api/health');

            if (!response.ok) throw new Error('Backend belum tersedia');

            return response.json() as Promise<{ message: string }>;
        },
    });

    return (
        <main>
            <h1>Aku Senang Belajar</h1>
            <p>
                {health.isPending
                    ? 'Menghubungi backend…'
                    : health.isError
                      ? health.error.message
                      : health.data.message}
            </p>
            <Link to="/about">Tentang</Link>
        </main>
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route
                        path="/about"
                        element={
                            <main>
                                <h1>Selamat belajar!</h1>
                                <Link to="/">Beranda</Link>
                            </main>
                        }
                    />
                    <Route
                        path="*"
                        element={<Link to="/">Kembali ke beranda</Link>}
                    />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
);
