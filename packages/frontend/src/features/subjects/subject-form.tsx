import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormField } from '../../components/form-field';
import { CloseIcon } from '../../components/icons/close-icon';
import { ErrorToast } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { drawings, palette, SubjectPreview } from '../assignments/subject-art';
import {
    SUBJECT_COLORS,
    SUBJECT_ICONS,
    type SubjectColor,
    type SubjectIcon,
    type SubjectInfo,
    useCreateSubject,
} from './queries';

const choice =
    'peer-checked:border-primary peer-checked:ring-primary peer-focus-visible:outline-ring flex cursor-pointer items-center justify-center rounded-xl border-2 border-border bg-white peer-checked:ring-2 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2';

/** Name, colour and icon of a new subject, with a preview of its sticker. */
export function SubjectForm({
    onCreated,
    onCancel,
}: {
    onCreated: (subject: SubjectInfo) => void;
    onCancel?: () => void;
}) {
    const create = useCreateSubject();
    const id = useId();
    const [name, setName] = useState('');
    const [color, setColor] = useState<SubjectColor>('purple');
    const [icon, setIcon] = useState<SubjectIcon>('book');
    const nameError =
        create.error instanceof ApiError &&
        create.error.body.name === 'SUBJECT_EXISTS'
            ? 'Nama mata pelajaran ini sudah ada.'
            : null;
    return (
        <form
            className="space-y-5"
            onSubmit={(event) => {
                event.preventDefault();
                // This form can sit inside the upload form in React's tree.
                event.stopPropagation();
                create.mutate(
                    { name: name.trim(), color, icon },
                    {
                        onSuccess: (subject) => {
                            setName('');
                            create.reset();
                            onCreated(subject);
                        },
                    },
                );
            }}
        >
            <div className="flex items-end gap-4">
                <SubjectPreview
                    color={color}
                    icon={icon}
                    className="size-16 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <FormField
                        id={`${id}-name`}
                        name="name"
                        label="Nama mata pelajaran"
                        required
                        minLength={2}
                        maxLength={40}
                        value={name}
                        onChange={(event) => setName(event.currentTarget.value)}
                        error={create.error}
                    />
                </div>
            </div>
            <fieldset>
                <legend className="mb-2 font-medium">Warna</legend>
                <div className="flex flex-wrap gap-2">
                    {SUBJECT_COLORS.map((value) => (
                        <label key={value} className="relative">
                            <input
                                type="radio"
                                name={`${id}-color`}
                                value={value}
                                checked={color === value}
                                onChange={() => setColor(value)}
                                aria-label={palette[value].label}
                                className="peer absolute inset-0 opacity-0"
                            />
                            <span
                                aria-hidden="true"
                                className={cn(choice, 'size-12')}
                            >
                                <span
                                    className={cn(
                                        'size-7 rounded-full',
                                        palette[value].swatch,
                                    )}
                                />
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <fieldset>
                <legend className="mb-2 font-medium">Ikon</legend>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {SUBJECT_ICONS.map((value) => (
                        <label key={value} className="relative">
                            <input
                                type="radio"
                                name={`${id}-icon`}
                                value={value}
                                checked={icon === value}
                                onChange={() => setIcon(value)}
                                aria-label={drawings[value].label}
                                className="peer absolute inset-0 opacity-0"
                            />
                            <span
                                aria-hidden="true"
                                className={cn(choice, 'aspect-square p-1.5')}
                            >
                                <SubjectPreview
                                    color={color}
                                    icon={value}
                                    className="size-full"
                                />
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <ErrorToast error={create.error} message={nameError} />
            <div className="flex justify-end gap-3">
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={create.isPending}
                        onClick={onCancel}
                    >
                        Batal
                    </Button>
                )}
                <Button
                    type="submit"
                    className="flex-1 px-4 sm:flex-none"
                    disabled={create.isPending}
                >
                    {create.isPending ? 'Menyimpan…' : 'Simpan mata pelajaran'}
                </Button>
            </div>
        </form>
    );
}

/** Opens the subject form in a dialog of its own, outside any form it is used from. */
export function NewSubjectButton({
    onCreated,
}: {
    onCreated: (subject: SubjectInfo) => void;
}) {
    const [open, setOpen] = useState(false);
    const [round, setRound] = useState(0);
    const titleId = useId();
    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="min-h-11 px-3"
                onClick={() => {
                    setRound((value) => value + 1);
                    setOpen(true);
                }}
            >
                + Mata pelajaran baru
            </Button>
            {typeof document !== 'undefined' &&
                createPortal(
                    <Dialog
                        key={round}
                        open={open}
                        onClose={() => setOpen(false)}
                        aria-labelledby={titleId}
                        className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto"
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <h2
                                id={titleId}
                                className="font-display text-primary-deep flex-1 text-2xl font-semibold"
                            >
                                Mata pelajaran baru
                            </h2>
                            <button
                                type="button"
                                aria-label="Tutup"
                                onClick={() => setOpen(false)}
                                className="hover:bg-secondary focus-visible:outline-ring flex size-11 items-center justify-center rounded-xl focus-visible:outline-3"
                            >
                                <CloseIcon />
                            </button>
                        </div>
                        <SubjectForm
                            onCancel={() => setOpen(false)}
                            onCreated={(subject) => {
                                setOpen(false);
                                onCreated(subject);
                            }}
                        />
                    </Dialog>,
                    document.body,
                )}
        </>
    );
}
