import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
export type Credential = { username: string; password: string };
export function CredentialSheet({
    items,
    onClose,
}: {
    items: Credential[];
    onClose: () => void;
}) {
    const [message, setMessage] = useState('');
    const headingId = useId();
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        ref.current?.focus();
    }, []);
    return (
        <section
            ref={ref}
            tabIndex={-1}
            className="credential-sheet border-primary bg-background focus-visible:outline-ring space-y-4 rounded-xl border-2 p-6 focus-visible:outline-3 focus-visible:outline-offset-3"
            aria-labelledby={headingId}
        >
            <h2 id={headingId} className="text-xl font-bold">
                Simpan kata sandi sekarang
            </h2>
            <p>
                Kata sandi ini hanya ditampilkan saat ini. Bagikan secara
                pribadi kepada pemilik akun sebelum menutup panel.
            </p>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li key={item.username} className="break-all">
                        <span className="font-semibold">{item.username}</span>:{' '}
                        <code className="select-all">{item.password}</code>
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-3">
                <Button
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(
                                items
                                    .map(
                                        (item) =>
                                            `${item.username}: ${item.password}`,
                                    )
                                    .join('\n'),
                            );
                            setMessage('Kata sandi disalin.');
                        } catch {
                            setMessage(
                                'Belum bisa menyalin. Pilih teks atau gunakan Cetak.',
                            );
                        }
                    }}
                >
                    Salin kata sandi
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                    Cetak
                </Button>
                <Button variant="outline" onClick={onClose}>
                    Sudah disimpan, tutup
                </Button>
            </div>
            <p role="status">{message}</p>
        </section>
    );
}
