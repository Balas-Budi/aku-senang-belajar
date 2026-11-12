import { useId, useState } from 'react';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { inputVariants } from '../../components/ui/input';
import { cn } from '../../lib/cn';
import { type Report, useReportActions } from './queries';

const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' });

function checkedOf(report: Report) {
    return report?.text != null &&
        report.checkedAt !== null &&
        (report.draftedAt === null || report.checkedAt >= report.draftedAt)
        ? { text: report.text, at: report.checkedAt }
        : null;
}

function Editor({
    report,
    onSave,
    saving,
}: {
    report: NonNullable<Report>;
    onSave: (text: string) => void;
    saving: boolean;
}) {
    const checked = checkedOf(report);
    const [text, setText] = useState(checked?.text ?? report.draft ?? '');
    const id = useId();
    return (
        <form
            className="space-y-3 print:hidden"
            onSubmit={(event) => {
                event.preventDefault();
                onSave(text);
            }}
        >
            <label htmlFor={id} className="block font-semibold">
                {checked ? (
                    `Sudah diperiksa guru, ${day.format(new Date(checked.at))}`
                ) : (
                    <span className="text-ai-suggestion">
                        Saran AI, belum diperiksa
                    </span>
                )}
            </label>
            <textarea
                id={id}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={9}
                maxLength={3000}
                className={cn(inputVariants(), 'min-h-48 leading-relaxed')}
            />
            <Button type="submit" disabled={saving || text.trim() === ''}>
                {saving ? 'Menyimpan…' : 'Simpan sebagai sudah diperiksa'}
            </Button>
        </form>
    );
}

export function ReportText({
    classId,
    reportUrl,
    report,
    summaryCount,
    about,
    readOnly = false,
}: {
    classId: number;
    reportUrl: string;
    report: Report;
    summaryCount: number;
    about: string;
    readOnly?: boolean;
}) {
    const { draft, check } = useReportActions(classId, reportUrl);
    const drafting = report?.drafting === 'generating' || draft.isPending;
    const checked = checkedOf(report);
    const written = report?.draft != null || checked !== null;
    return (
        <Card>
            <section aria-labelledby="report-title" className="space-y-4">
                <div className="space-y-1">
                    <h2 id="report-title" className="text-lg font-semibold">
                        Ringkasan untuk guru
                    </h2>
                    <p className="text-muted-foreground text-sm print:hidden">
                        {about}
                        {!readOnly && ' Periksa dan ubah dulu sebelum dicetak.'}
                    </p>
                </div>
                {readOnly && !checked && (
                    <div className="space-y-2 print:hidden">
                        {report?.draft != null ? (
                            <>
                                <p className="text-ai-suggestion font-semibold">
                                    Saran AI, belum diperiksa
                                </p>
                                <p className="leading-relaxed whitespace-pre-line">
                                    {report.draft}
                                </p>
                            </>
                        ) : (
                            <p>Belum ada ringkasan.</p>
                        )}
                    </div>
                )}
                {!readOnly && summaryCount === 0 && (
                    <p className="print:hidden">
                        Belum ada ringkasan misi yang bisa dipakai. Ringkasan
                        muncul setelah misi siswa dianalisis, dan ringkasan yang
                        ditandai tidak sesuai tidak dipakai.
                    </p>
                )}
                {drafting && (
                    <Alert role="status" className="print:hidden">
                        Sedang disusun AI. Halaman ini memperbarui sendiri.
                    </Alert>
                )}
                {!readOnly && (
                    <>
                        {report?.drafting === 'failed' && !drafting && (
                            <Alert tone="attention" className="print:hidden">
                                Ringkasan gagal disusun. Coba susun ulang.
                            </Alert>
                        )}
                        {report?.outdated && !drafting && (
                            <Alert tone="attention" className="print:hidden">
                                Ada misi baru atau ringkasan misi yang berubah
                                sejak ringkasan ini disusun.
                            </Alert>
                        )}
                        {report && written && (
                            <Editor
                                key={`${report.draftedAt}-${report.checkedAt}`}
                                report={report}
                                saving={check.isPending}
                                onSave={(text) =>
                                    check.mutate({ reportId: report.id, text })
                                }
                            />
                        )}
                        <div className="flex flex-wrap gap-2 print:hidden">
                            <Button
                                variant={written ? 'outline' : 'primary'}
                                disabled={drafting || summaryCount === 0}
                                onClick={() => draft.mutate()}
                            >
                                {written ? 'Susun ulang' : 'Susun ringkasan'}
                            </Button>
                        </div>
                        <RequestError error={draft.error ?? check.error} />
                    </>
                )}
                <div
                    className={cn(
                        'space-y-2',
                        !(readOnly && checked) && 'hidden print:block',
                    )}
                >
                    {checked ? (
                        <>
                            <p className="text-sm">
                                Diperiksa guru,{' '}
                                {day.format(new Date(checked.at))}
                            </p>
                            <p className="leading-relaxed whitespace-pre-line">
                                {checked.text}
                            </p>
                        </>
                    ) : (
                        <p>
                            Ringkasan belum diperiksa guru, jadi tidak ikut
                            dicetak.
                        </p>
                    )}
                </div>
            </section>
        </Card>
    );
}
