import { ErrorToast } from '../../components/request-error';
import { useState } from 'react';
import {
    useCompetencyDrafts,
    useSaveModule,
    type CompetencyDraft,
} from './queries';
import { FormField, TextAreaField } from '../../components/form-field';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ApiError } from '../../lib/api';
import { StudioError } from '../studio/studio-error';

type Draft = {
    description: string;
    pages: string;
    visible: string;
    developing: string;
    notEnough: string;
};

const MAX_COMPETENCIES = 6;
const emptyDraft: Draft = {
    description: '',
    pages: '',
    visible: '',
    developing: '',
    notEnough: '',
};

const linesOf = (text: string) =>
    text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

const pagesOf = (text: string) => (text.match(/\d+/g) ?? []).map(Number);

const toDraft = ({ description, pages, rubric }: CompetencyDraft): Draft => ({
    description,
    pages: pages.join(', '),
    visible: rubric.visible.join('\n'),
    developing: rubric.developing.join('\n'),
    notEnough: rubric.notEnough.join('\n'),
});

function CompetencyCard({
    index,
    draft,
    error,
    onChange,
    onRemove,
}: {
    index: number;
    draft: Draft;
    error: unknown;
    onChange: (patch: Partial<Draft>) => void;
    onRemove?: () => void;
}) {
    const field = `competencies/${index}`;
    return (
        <fieldset className="border-paper-edge space-y-4 rounded-lg border p-4">
            <legend className="px-1 font-semibold">C{index + 1}</legend>
            <TextAreaField
                name={`${field}/description`}
                label="Deskripsi"
                hint="Satu kalimat tujuan belajar yang diawali kata kerja."
                rows={2}
                required
                value={draft.description}
                error={error}
                onChange={(event) =>
                    onChange({ description: event.currentTarget.value })
                }
            />
            <FormField
                name={`${field}/pages`}
                label="Halaman sumber"
                inputMode="numeric"
                placeholder="Contoh: 12, 13"
                value={draft.pages}
                onChange={(event) =>
                    onChange({ pages: event.currentTarget.value })
                }
                error={error}
            />
            <p className="text-muted-foreground text-sm">
                Rubrik: tulis satu indikator per baris.
            </p>
            <TextAreaField
                name={`${field}/rubric/visible`}
                label="Terlihat"
                rows={3}
                required
                value={draft.visible}
                error={error}
                onChange={(event) =>
                    onChange({ visible: event.currentTarget.value })
                }
            />
            <TextAreaField
                name={`${field}/rubric/developing`}
                label="Berkembang"
                rows={3}
                required
                value={draft.developing}
                error={error}
                onChange={(event) =>
                    onChange({ developing: event.currentTarget.value })
                }
            />
            <TextAreaField
                name={`${field}/rubric/notEnough`}
                label="Belum cukup bukti"
                rows={2}
                required
                value={draft.notEnough}
                error={error}
                onChange={(event) =>
                    onChange({ notEnough: event.currentTarget.value })
                }
            />
            {onRemove && (
                <Button variant="outline" onClick={onRemove}>
                    Hapus C{index + 1}
                </Button>
            )}
        </fieldset>
    );
}

export function ModuleForm({
    materialId,
    pageCount,
}: {
    materialId: number;
    pageCount: number;
}) {
    const propose = useCompetencyDrafts(materialId);
    const save = useSaveModule(materialId);
    const [title, setTitle] = useState('');
    const [firstPage, setFirstPage] = useState('1');
    const [lastPage, setLastPage] = useState(String(Math.min(pageCount, 20)));
    const [drafts, setDrafts] = useState<Draft[] | null>(null);
    const [message, setMessage] = useState('');
    const range = {
        title,
        firstPage: Number(firstPage),
        lastPage: Number(lastPage),
    };
    const rangeError = save.error ?? propose.error;
    const aiUnavailable =
        propose.error instanceof ApiError &&
        (propose.error.status === 502 || propose.error.status === 503);
    const change = (index: number, patch: Partial<Draft>) =>
        setDrafts(
            (list) =>
                list &&
                list.map((draft, at) =>
                    at === index ? { ...draft, ...patch } : draft,
                ),
        );
    return (
        <Card>
            <section aria-labelledby="module-form-title" className="space-y-4">
                <div>
                    <h2
                        id="module-form-title"
                        className="text-lg font-semibold"
                    >
                        Bab dari halaman pilihan Anda
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Untuk bab yang terlewat atau terpotong keliru. Pilih
                        halamannya, AI mengusulkan kompetensinya, lalu Anda
                        periksa dan simpan.
                    </p>
                </div>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setMessage('');
                        save.reset();
                        propose.mutate(range, {
                            onSuccess: ({ competencies }) =>
                                setDrafts(competencies.map(toDraft)),
                        });
                    }}
                >
                    <FormField
                        name="title"
                        label="Judul bab"
                        required
                        maxLength={120}
                        value={title}
                        onChange={(event) =>
                            setTitle(event.currentTarget.value)
                        }
                        error={rangeError}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            name="firstPage"
                            label="Dari halaman"
                            type="number"
                            min={1}
                            max={pageCount}
                            required
                            value={firstPage}
                            onChange={(event) =>
                                setFirstPage(event.currentTarget.value)
                            }
                            error={rangeError}
                        />
                        <FormField
                            name="lastPage"
                            label="Sampai halaman"
                            type="number"
                            min={1}
                            max={pageCount}
                            required
                            value={lastPage}
                            onChange={(event) =>
                                setLastPage(event.currentTarget.value)
                            }
                            error={rangeError}
                        />
                    </div>
                    <p className="text-muted-foreground text-sm">
                        Paling banyak 60 halaman. Halaman yang tidak terbaca
                        dilewati.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button type="submit" disabled={propose.isPending}>
                            {propose.isPending
                                ? 'AI sedang membaca halaman…'
                                : drafts
                                  ? 'Usulkan ulang'
                                  : 'Usulkan kompetensi'}
                        </Button>
                        {!drafts && (
                            <Button
                                variant="outline"
                                onClick={() => setDrafts([{ ...emptyDraft }])}
                            >
                                Tulis sendiri
                            </Button>
                        )}
                    </div>
                    {aiUnavailable ? (
                        <ErrorToast
                            error={propose.error}
                            message="AI belum bisa mengusulkan kompetensi sekarang. Coba lagi sebentar lagi, atau tulis kompetensinya sendiri."
                        />
                    ) : (
                        <StudioError error={propose.error} />
                    )}
                </form>
                {drafts && (
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save.mutate(
                                {
                                    ...range,
                                    competencies: drafts.map(
                                        (draft, index) => ({
                                            code: `C${index + 1}`,
                                            description:
                                                draft.description.trim(),
                                            pages: pagesOf(draft.pages),
                                            rubric: {
                                                visible: linesOf(draft.visible),
                                                developing: linesOf(
                                                    draft.developing,
                                                ),
                                                notEnough: linesOf(
                                                    draft.notEnough,
                                                ),
                                            },
                                        }),
                                    ),
                                },
                                {
                                    onSuccess: (module) => {
                                        setDrafts(null);
                                        setTitle('');
                                        setMessage(
                                            `Bab ${module.title} tersimpan.`,
                                        );
                                    },
                                },
                            );
                        }}
                    >
                        <h3 className="font-semibold">Kompetensi</h3>
                        {drafts.map((draft, index) => (
                            <CompetencyCard
                                key={index}
                                index={index}
                                draft={draft}
                                error={save.error}
                                onChange={(patch) => change(index, patch)}
                                onRemove={
                                    drafts.length > 1
                                        ? () =>
                                              setDrafts(
                                                  drafts.filter(
                                                      (_, at) => at !== index,
                                                  ),
                                              )
                                        : undefined
                                }
                            />
                        ))}
                        {drafts.length < MAX_COMPETENCIES && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setDrafts([...drafts, { ...emptyDraft }])
                                }
                            >
                                Tambah kompetensi
                            </Button>
                        )}
                        <StudioError error={save.error} />
                        <div>
                            <Button type="submit" disabled={save.isPending}>
                                {save.isPending
                                    ? 'Menyimpan bab…'
                                    : 'Simpan bab'}
                            </Button>
                        </div>
                    </form>
                )}
                <p role="status">{message}</p>
            </section>
        </Card>
    );
}
