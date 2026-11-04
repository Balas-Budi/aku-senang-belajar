import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useLogoutAll } from './queries';
import { JalakBali } from '../../components/jalak-bali';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useErrorToast } from '../../components/ui/toast';
import {
    RequestError,
    requestErrorMessage,
} from '../../components/request-error';
import { cn } from '../../lib/cn';
export function LogoutEverywhere({ student }: { student: boolean }) {
    const logoutAll = useLogoutAll();
    const client = useQueryClient();
    const navigate = useNavigate();
    const showError = useErrorToast();
    const [open, setOpen] = useState(false);
    const feel = student ? 'chunky' : 'flat';
    return (
        <section
            aria-labelledby="logout-everywhere-title"
            className={cn(
                'space-y-4',
                student
                    ? 'border-paper-edge rounded-[28px] border-2 border-b-[6px] bg-white p-6 sm:p-10'
                    : 'border-border border-t pt-8',
            )}
        >
            <h2
                id="logout-everywhere-title"
                className={
                    student
                        ? 'font-display text-primary-deep text-2xl font-semibold sm:text-3xl'
                        : 'text-primary-deep text-2xl font-bold'
                }
            >
                Keluar dari semua perangkat
            </h2>
            <p className="text-muted-foreground leading-relaxed">
                Pakai ini kalau kamu pernah masuk di perangkat lain, misalnya
                komputer sekolah, lalu lupa keluar. Semua perangkat akan keluar,
                termasuk perangkat ini.
            </p>
            <Button
                variant="outline"
                feel={feel}
                className={cn(student && 'w-full sm:w-auto')}
                onClick={() => setOpen(true)}
            >
                Keluar dari semua perangkat
            </Button>
            <Dialog
                open={open}
                onClose={() => {
                    if (!logoutAll.isPending) setOpen(false);
                }}
                onCancel={(event) => {
                    if (logoutAll.isPending) event.preventDefault();
                }}
                aria-labelledby="logout-everywhere-dialog-title"
                aria-describedby="logout-everywhere-dialog-description"
                className={cn(
                    student &&
                        'font-rounded border-paper-edge border-2 text-center',
                )}
            >
                {student && <JalakBali sad className="mx-auto w-28" />}
                <h2
                    id="logout-everywhere-dialog-title"
                    className={
                        student
                            ? 'font-display text-primary-deep mt-3 text-3xl font-semibold'
                            : 'text-primary-deep text-xl font-bold'
                    }
                >
                    Keluar dari semua perangkat?
                </h2>
                <p
                    id="logout-everywhere-dialog-description"
                    className={cn(
                        'text-muted-foreground mt-2 leading-relaxed',
                        student && 'text-lg',
                    )}
                >
                    Setelah ini, kamu perlu masuk lagi dengan kata sandimu di
                    setiap perangkat, termasuk perangkat ini.
                </p>
                {!student && (
                    <div className="mt-4">
                        <RequestError error={logoutAll.error} />
                    </div>
                )}
                <div
                    className={cn(
                        'mt-6 flex flex-wrap gap-3',
                        student && 'justify-center',
                    )}
                >
                    <Button
                        variant="outline"
                        feel={feel}
                        autoFocus
                        disabled={logoutAll.isPending}
                        onClick={() => setOpen(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        feel={feel}
                        disabled={logoutAll.isPending}
                        onClick={() =>
                            logoutAll.mutate(undefined, {
                                onSuccess: async () => {
                                    await navigate('/login', { replace: true });
                                    client.clear();
                                },
                                onError: (error) => {
                                    if (!student) return;
                                    setOpen(false);
                                    showError(requestErrorMessage(error));
                                },
                            })
                        }
                    >
                        {logoutAll.isPending
                            ? 'Sedang keluar…'
                            : 'Ya, keluar dari semua'}
                    </Button>
                </div>
            </Dialog>
        </section>
    );
}
