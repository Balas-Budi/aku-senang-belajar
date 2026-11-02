import { data } from 'react-router';

export function loader() {
    return data(null, { status: 404 });
}

export default function NotFound() {
    return (
        <main className="mx-auto max-w-xl p-8">
            <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
        </main>
    );
}
