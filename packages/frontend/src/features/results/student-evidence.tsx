import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { cn } from '../../lib/cn';
import { subjects } from '../assignments/subject-art';
import { Illustration } from '../learning-sessions/illustration';
import { interests } from '../profile/interests';
import { adaptationParts } from '../reports/adaptations';
import { AnalyseAgain, waitsForTeacher } from './analysis-state';
import {
    analysing,
    type Assessment,
    type CompetencyEvidence,
    type EvidenceQuestion,
    type SelfReport,
    studentEvidenceQuery,
    type StudentEvidence as Evidence,
} from './queries';
import { decisionLabels, ShownStatus, StatusChip } from './status';
import { VerificationForm } from './verification-form';
import { BackLink } from '../../components/back-link';

const kindLabels = {
    check: 'Soal cek',
    challenge: 'Tantangan (soal transfer)',
} as const;
const outcomeLabels = {
    correct: 'Benar',
    not_yet: 'Belum tepat',
    accepted: 'Tercatat',
} as const;
const uncertaintyLabels = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' };
const flagLabels = {
    thin: 'bukti sedikit',
    ambiguous: 'jawaban kurang jelas',
    conflicting: 'jawaban saling bertentangan',
};
function DecidedAt({ value }: { value: string }) {
    const [text, setText] = useState('');

    useEffect(() => {
        setText(
            new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(value)),
        );
    }, [value]);

    return (
        <time dateTime={value} className="text-muted-foreground text-sm">
            {text}
        </time>
    );
}

function helpUsed(help: EvidenceQuestion['help']) {
    const used = [
        help.hints > 0 ? `${help.hints} petunjuk` : null,
        help.otherExample ? 'contoh lain' : null,
        help.answerShown ? 'jawaban ditunjukkan' : null,
        help.askedTeacher ? 'minta bantuan guru' : null,
    ].filter((item): item is string => item !== null);

    return used.length > 0 ? used.join(', ') : 'tanpa bantuan';
}

function CitedMark() {
    return (
        <>
            {' '}
            <span className="text-primary-deep ml-1 text-sm font-semibold">
                Dipakai AI
            </span>
        </>
    );
}

function QuestionEvidence({
    question,
    cited,
}: {
    question: EvidenceQuestion;
    cited: Set<number>;
}) {
    const labelOf = (id: string) =>
        question.options.find((option) => option.id === id)?.label ?? id;

    return (
        <article className="space-y-3">
            <p className="text-muted-foreground text-sm font-semibold">
                {kindLabels[question.kind]}
            </p>
            <p>{question.question}</p>
            {question.task && (
                <p className="text-sm">
                    <span className="font-semibold">Aktivitas:</span>{' '}
                    {question.task}
                </p>
            )}
            {question.picture && (
                <Illustration name={question.picture} className="max-w-48" />
            )}
            {question.diagram && (
                <p className="text-sm">
                    <span className="font-semibold">Gambar buatan AI:</span>{' '}
                    {question.diagram}
                </p>
            )}
            {question.options.some((option) => option.picture) && (
                <ul className="flex flex-wrap gap-3">
                    {question.options.map((option) => (
                        <li key={option.id} className="w-28 text-center">
                            {option.picture && (
                                <Illustration name={option.picture} />
                            )}
                            <span className="font-semibold">
                                {option.label}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-sm">
                Jawaban benar: <strong>{labelOf(question.rightOption)}</strong>
            </p>
            <ol className="space-y-2">
                {question.tries.map((attempt) => (
                    <li
                        key={attempt.ref}
                        className={cn(
                            'border-paper-edge rounded-lg border p-3',
                            cited.has(attempt.ref) &&
                                'border-primary bg-secondary',
                        )}
                    >
                        <p>
                            <span className="font-semibold">
                                Percobaan {attempt.try}:
                            </span>{' '}
                            {labelOf(attempt.choice)} ·{' '}
                            {outcomeLabels[attempt.outcome]}
                            {cited.has(attempt.ref) && <CitedMark />}
                        </p>
                        {attempt.reason && (
                            <p className="mt-1 text-sm">
                                Alasan: “{attempt.reason}”
                            </p>
                        )}
                    </li>
                ))}
            </ol>
            <p className="text-sm">
                Bantuan: {helpUsed(question.help)}
                {question.help.diagrams &&
                    ` · Gambar di bantuan: ${question.help.diagrams.map((label) => `“${label}”`).join(', ')}`}
            </p>
        </article>
    );
}

function Reflection({ report, cited }: { report: SelfReport; cited: boolean }) {
    return (
        <div
            className={cn(
                'border-paper-edge space-y-1 rounded-lg border p-3',
                cited && 'border-primary bg-secondary',
            )}
        >
            <p className="font-semibold">
                Refleksi siswa
                {cited && <CitedMark />}
            </p>
            <p className="text-muted-foreground text-sm">
                Pendapat siswa sendiri, pendukung dan bukan bukti utama.
            </p>
            {report.understood.length > 0 && (
                <p>Sudah paham: {report.understood.join(', ')}</p>
            )}
            {report.confusing.length > 0 && (
                <p>Masih bingung: {report.confusing.join(', ')}</p>
            )}
            {report.note && <p>Catatan siswa: “{report.note}”</p>}
        </div>
    );
}

function Interpretation({ assessment }: { assessment: Assessment }) {
    return (
        <div className="space-y-2">
            <h3 className="text-lg font-semibold">Alasan AI</h3>
            <p>{assessment.reason}</p>
            <p className="text-sm">
                Ketidakpastian:{' '}
                <strong>{uncertaintyLabels[assessment.uncertainty]}</strong>
                {assessment.flags.length > 0 &&
                    `, ${assessment.flags.map((flag) => flagLabels[flag]).join(', ')}`}
            </p>
        </div>
    );
}

function Rubric({
    code,
    rubric,
}: {
    code: string;
    rubric: NonNullable<CompetencyEvidence['rubric']>;
}) {
    const levels = [
        ['Terlihat', rubric.visible],
        ['Berkembang', rubric.developing],
        ['Belum cukup bukti', rubric.notEnough],
    ] as const;

    return (
        <details className="border-paper-edge rounded-lg border px-4 py-2">
            <summary className="focus-visible:outline-ring cursor-pointer py-2.5 font-semibold focus-visible:outline-3">
                Rubrik {code}
            </summary>
            <div className="space-y-3 pb-2">
                {levels.map(([title, indicators]) => (
                    <div key={title}>
                        <p className="font-semibold">{title}</p>
                        <ul className="list-disc space-y-1 pl-5">
                            {indicators.map((indicator) => (
                                <li key={indicator}>{indicator}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </details>
    );
}

function History({ assessment }: { assessment: Assessment }) {
    return (
        <div className="space-y-2">
            <h3 className="text-lg font-semibold">Riwayat keputusan</h3>
            <ol className="divide-paper-edge divide-y">
                {assessment.verifications.map((verification) => (
                    <li key={verification.id} className="space-y-1 py-2">
                        <p className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                                {decisionLabels[verification.decision]}
                            </span>
                            <StatusChip status={verification.status} />
                            <DecidedAt value={verification.createdAt} />
                        </p>
                        {verification.note && (
                            <p className="text-sm">
                                Catatan: {verification.note}
                            </p>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}

function CompetencyCard({
    classId,
    assignmentId,
    competency,
}: {
    classId: number;
    assignmentId: number;
    competency: CompetencyEvidence;
}) {
    const { code, description, rubric, questions, selfReport, assessment } =
        competency;
    const cited = new Set(assessment?.evidence ?? []);
    const titleId = `kompetensi-${code}-judul`;

    return (
        <Card
            id={`kompetensi-${code}`}
            role="region"
            aria-labelledby={titleId}
            className="scroll-mt-6 space-y-5 sm:p-6"
        >
            <div className="space-y-3">
                <h2
                    id={titleId}
                    className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                >
                    <span className="text-muted-foreground mr-1">{code}</span>{' '}
                    {description}
                </h2>
                {assessment ? (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <ShownStatus shown={assessment.shown} />
                        {assessment.shown.decision !== null && (
                            <span className="flex items-center gap-2 text-sm">
                                <span className="text-ai-suggestion font-medium">
                                    Saran AI:
                                </span>
                                <StatusChip status={assessment.status} />
                            </span>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground">
                        Belum ada estimasi untuk kompetensi ini.
                    </p>
                )}
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-5">
                    <h3 className="text-lg font-semibold">Jawaban siswa</h3>
                    {questions.length === 0 && (
                        <p>Belum ada jawaban soal untuk kompetensi ini.</p>
                    )}
                    {questions.map((question) => (
                        <QuestionEvidence
                            key={question.block}
                            question={question}
                            cited={cited}
                        />
                    ))}
                    {selfReport && (
                        <Reflection
                            report={selfReport}
                            cited={cited.has(selfReport.ref)}
                        />
                    )}
                </div>
                <div className="space-y-5">
                    {assessment && <Interpretation assessment={assessment} />}
                    {rubric && <Rubric code={code} rubric={rubric} />}
                    {assessment && assessment.followUps.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">
                                Pertanyaan untuk ditanyakan langsung
                            </h3>
                            <ul className="list-disc space-y-1 pl-5">
                                {assessment.followUps.map((question) => (
                                    <li key={question}>{question}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {assessment && (
                        <VerificationForm
                            classId={classId}
                            assignmentId={assignmentId}
                            assessment={assessment}
                            code={code}
                        />
                    )}
                    {assessment && assessment.verifications.length > 0 && (
                        <History assessment={assessment} />
                    )}
                </div>
            </div>
        </Card>
    );
}

function AnalysisSummary({
    classId,
    evidence,
}: {
    classId: number;
    evidence: Evidence;
}) {
    const { progress, analysis, attemptId, student } = evidence;

    if (progress === 'not_started')
        return <p>Belum mulai. Siswa ini belum memulai misi.</p>;
    if (progress === 'in_progress')
        return (
            <p>
                Sedang mengerjakan. Analisis berjalan setelah siswa mengirim
                misi.
            </p>
        );
    if (analysing(analysis))
        return (
            <Alert role="status">
                Sedang dianalisis. Halaman ini diperbarui sendiri.
            </Alert>
        );
    if (attemptId !== null && waitsForTeacher(progress, analysis))
        return (
            <Alert tone="attention" className="space-y-3">
                <p role="status">
                    Menunggu analisis.{' '}
                    {analysis === 'failed'
                        ? 'Analisis belum berhasil.'
                        : 'Analisis belum dijalankan.'}{' '}
                    Jawaban siswa tetap tersimpan.
                </p>
                <AnalyseAgain
                    classId={classId}
                    attemptId={attemptId}
                    analysis={analysis}
                    studentName={student.name}
                />
            </Alert>
        );

    return <p role="status">Sudah mengirim dan sudah dianalisis.</p>;
}

export function StudentEvidence({
    classId,
    assignmentId,
    studentId,
}: {
    classId: number;
    assignmentId: number;
    studentId: number;
}) {
    const evidence = useQuery(
        studentEvidenceQuery(classId, assignmentId, studentId),
    );
    const back = (title?: string) => (
        <BackLink
            to={`/teacher/classes/${classId}/sessions/${assignmentId}#siswa-${studentId}`}
        >
            Kembali ke hasil {title ?? 'misi'}
        </BackLink>
    );

    if (evidence.isPending) {
        return (
            <>
                {back()}
                <p role="status">Memuat bukti siswa…</p>
            </>
        );
    }

    if (evidence.isError) {
        return (
            <>
                {back()}
                <div className="space-y-3">
                    <RequestError error={evidence.error} />
                    <Button
                        onClick={() => {
                            void evidence.refetch();
                        }}
                    >
                        Muat ulang bukti
                    </Button>
                </div>
            </>
        );
    }

    const { student, assignment, competencies, summary, theme, adaptation } =
        evidence.data;

    return (
        <div className="space-y-6">
            {back(assignment.title)}
            <Card className="space-y-2 print:border-0 print:p-0 print:shadow-none">
                <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                    {student.name}
                </h1>
                <p className="text-muted-foreground">
                    {assignment.title} · {subjects[assignment.subject].label} ·{' '}
                    {assignment.moduleTitle}
                </p>
                {theme && (
                    <p>
                        Tema cerita:{' '}
                        {interests.find((interest) => interest.key === theme)
                            ?.label ?? theme}
                    </p>
                )}
                {adaptation && (
                    <p>
                        Penyesuaian misi ini:{' '}
                        {adaptationParts(
                            adaptation,
                            'dibacakan otomatis (bila perangkat punya suara)',
                        )}
                    </p>
                )}
                <AnalysisSummary classId={classId} evidence={evidence.data} />
                {summary && (
                    <p
                        className={cn(
                            'leading-relaxed',
                            summary.excluded && 'text-muted-foreground',
                        )}
                    >
                        <span className="text-ai-suggestion font-medium">
                            Ringkasan misi, saran AI:
                        </span>{' '}
                        {summary.text}
                        {summary.excluded && ' (ditandai tidak sesuai)'}
                    </p>
                )}
                <Link
                    to={`/teacher/classes/${classId}/students/${student.id}`}
                    className={buttonVariants({
                        variant: 'outline',
                        className: 'min-h-11 bg-white px-4',
                    })}
                >
                    Lihat laporan {student.name}
                </Link>
            </Card>
            {competencies.map((competency) => (
                <CompetencyCard
                    key={competency.id}
                    classId={classId}
                    assignmentId={assignmentId}
                    competency={competency}
                />
            ))}
        </div>
    );
}
