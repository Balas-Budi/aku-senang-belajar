import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from 'react-router';
import type { Route } from './+types/root';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/inter';
import '@fontsource-variable/nunito';
import './styles.css';

export const meta: Route.MetaFunction = () => [{ title: 'Aku Senang Belajar' }];

export function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang="id">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
            </head>
            <body className="bg-background text-foreground antialiased">
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { staleTime: 60_000 } },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <Outlet />
        </QueryClientProvider>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const notFound = isRouteErrorResponse(error) && error.status === 404;

    return (
        <main className="mx-auto max-w-xl p-8">
            <h1 className="text-2xl font-semibold">
                {notFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'}
            </h1>
        </main>
    );
}
