import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { studentClassQuery, useJoinClass, useLeaveClass } from './queries';
import { ClassCodeField, inviteCodeMessages } from './class-code-field';
import { meQuery } from '../auth/queries';
import { AssignmentList } from '../assignments/assignment-list';
import { studentAssignmentsQuery } from '../assignments/queries';
import { PerchedJalak } from '../student/perched-jalak';
import { SchoolBag } from '../student/school-bag';
import { EmptyClassIllustration } from '../student/empty-class-illustration';
import { WelcomeStickers } from '../student/welcome-stickers';
import { Button } from '../../components/ui/button';
import { LottieMoment } from '../../components/lottie-moment';
import { useErrorToast } from '../../components/ui/toast';
import {
    RequestError,
    requestErrorMessage,
} from '../../components/request-error';
export function StudentClass() {
    const query = useQuery(studentClassQuery());
    const assignments = useQuery(studentAssignmentsQuery());
    const { data: user } = useQuery(meQuery());
    const join = useJoinClass();
    const leave = useLeaveClass();
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [typing, setTyping] = useState(false);
    const [cheers, setCheers] = useState(0);
    const [schoolGreets, setSchoolGreets] = useState(0);
    const codeSlots = useRef<HTMLDivElement>(null);
    const showError = useErrorToast();
    if (query.isPending)
        return (
            <p
                role="status"
                className="border-paper-edge rounded-[24px] border-2 bg-white p-8"
            >
                Sebentar, kita buka kelasmu…
            </p>
        );
    if (query.isError)
        return (
            <div className="border-paper-edge space-y-4 rounded-[24px] border-2 bg-white p-6">
                <RequestError error={query.error} />
                <Button
                    feel="chunky"
                    onClick={() => {
                        void query.refetch();
                    }}
                >
                    Muat ulang kelas
                </Button>
            </div>
        );
    const classroom = query.data.classroom;
    const sessionCount = assignments.data?.length ?? 0;
    return (
        <div className="space-y-6">
            <section
                className="student-welcome border-paper-edge relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[24px] border-2 px-5 pt-6 pb-24 sm:gap-8 sm:px-8 sm:pt-8 sm:pb-28"
                aria-labelledby="student-welcome-title"
            >
                <WelcomeStickers cheers={cheers} />
                <div className="relative">
                    <h1
                        id="student-welcome-title"
                        className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-5xl"
                    >
                        Halo{user ? `, ${user.name.split(' ')[0]}` : ''}!
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-md text-lg leading-relaxed text-pretty sm:text-xl">
                        {!classroom
                            ? 'Masukkan kode kelas dari gurumu untuk mulai belajar.'
                            : sessionCount
                              ? `Gurumu sudah membagikan ${sessionCount} misi belajar.`
                              : 'Kelasmu sudah siap. Tunggu misi pertama dari gurumu, ya.'}
                    </p>
                </div>
                <SchoolBag
                    cheers={cheers}
                    className="relative w-24 sm:w-36 lg:w-44"
                />
            </section>
            <section
                className="border-paper-edge relative rounded-[24px] border-2 border-b-[6px] bg-white"
                aria-labelledby="student-class-title"
            >
                <PerchedJalak
                    watching={typing}
                    lookAt={codeSlots}
                    cheers={cheers}
                />
                {cheers > 0 && (
                    <LottieMoment
                        key={cheers}
                        path="/lottie/celebrate.json"
                        className="absolute top-0 left-1/2 z-10 aspect-[3/2] w-[min(100%,420px)] -translate-x-1/2 -translate-y-[72%]"
                    />
                )}
                <div className="flex items-center gap-3 px-5 pt-8 pb-4 sm:px-7">
                    <span
                        aria-hidden="true"
                        className="bg-secondary text-primary-deep flex size-11 items-center justify-center rounded-xl"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="size-7"
                        >
                            <path
                                d="m3 10 9-7 9 7v11H3V10Z"
                                strokeLinejoin="round"
                            />
                            <path d="M9 21v-7h6v7M9 9h6" />
                        </svg>
                    </span>
                    <h2
                        id="student-class-title"
                        className="font-display text-primary-deep text-2xl font-semibold"
                    >
                        Kelas belajarku
                    </h2>
                </div>
                <div className="border-paper-edge border-t-2 p-5 sm:p-7">
                    {classroom ? (
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="font-display text-primary-deep text-3xl font-semibold break-words">
                                        {classroom.name}
                                    </h3>
                                    <p className="text-muted-foreground mt-1 text-base break-words">
                                        Bersama {classroom.teacherName}
                                    </p>
                                </div>
                                <p className="text-primary bg-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold">
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 20 20"
                                        className="size-5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                    >
                                        <path
                                            d="m4 10 4 4 8-8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    Sudah bergabung
                                </p>
                            </div>
                            <AssignmentList
                                teacherName={classroom.teacherName}
                            />
                            <details className="text-base">
                                <summary className="text-muted-foreground focus-visible:outline-ring min-h-12 cursor-pointer rounded-lg py-3 underline underline-offset-4 focus-visible:outline-3">
                                    Ingin pindah kelas?
                                </summary>
                                <p className="my-3 leading-relaxed">
                                    Keluar dari kelas ini, lalu masukkan kode
                                    kelas baru dari guru.
                                </p>
                                {!confirmLeave ? (
                                    <Button
                                        variant="outline"
                                        feel="chunky"
                                        onClick={() => setConfirmLeave(true)}
                                    >
                                        Keluar dari kelas
                                    </Button>
                                ) : (
                                    <div className="space-y-3">
                                        <p>
                                            Yakin ingin keluar dari{' '}
                                            {classroom.name}?
                                        </p>
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                feel="chunky"
                                                disabled={leave.isPending}
                                                onClick={() =>
                                                    leave.mutate(undefined, {
                                                        onSuccess: () =>
                                                            setConfirmLeave(
                                                                false,
                                                            ),
                                                        onError: (error) =>
                                                            showError(
                                                                requestErrorMessage(
                                                                    error,
                                                                ),
                                                            ),
                                                    })
                                                }
                                            >
                                                {leave.isPending
                                                    ? 'Sedang keluar…'
                                                    : 'Ya, keluar dari kelas'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                feel="chunky"
                                                onClick={() =>
                                                    setConfirmLeave(false)
                                                }
                                            >
                                                Tetap di kelas
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </details>
                        </div>
                    ) : (
                        <div className="grid items-center gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
                            <div className="relative mx-auto w-40 md:w-full">
                                <span
                                    aria-hidden="true"
                                    className="bg-secondary/70 absolute top-1/2 left-1/2 aspect-square w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                                />
                                <EmptyClassIllustration
                                    greets={schoolGreets}
                                    className="relative"
                                />
                            </div>
                            <div>
                                <h3 className="font-display text-primary-deep text-3xl font-semibold">
                                    Belum ada kelas, nih!
                                </h3>
                                <p className="text-muted-foreground mt-2 text-lg leading-relaxed">
                                    Minta kode kelas ke gurumu, lalu ketik di
                                    kotak ini.
                                </p>
                                <form
                                    className="mt-5 space-y-5"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        join.mutate(
                                            String(
                                                new FormData(
                                                    event.currentTarget,
                                                ).get('inviteCode') ?? '',
                                            ),
                                            {
                                                onSuccess: () =>
                                                    setCheers(
                                                        (count) => count + 1,
                                                    ),
                                                onError: (error) =>
                                                    showError(
                                                        inviteCodeMessages(
                                                            error,
                                                        ).join(' ') ||
                                                            requestErrorMessage(
                                                                error,
                                                            ),
                                                    ),
                                            },
                                        );
                                    }}
                                >
                                    <ClassCodeField
                                        error={join.error}
                                        slotsRef={codeSlots}
                                        onFocusChange={setTyping}
                                        onComplete={() =>
                                            setSchoolGreets(
                                                (count) => count + 1,
                                            )
                                        }
                                        onEdit={() => {
                                            if (join.isError) join.reset();
                                        }}
                                    />
                                    <Button
                                        type="submit"
                                        feel="chunky"
                                        disabled={join.isPending}
                                        className="w-full px-8 sm:w-auto"
                                    >
                                        {join.isPending
                                            ? 'Menghubungkan…'
                                            : 'Gabung ke kelas'}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
