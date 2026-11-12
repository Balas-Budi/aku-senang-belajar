import { TextAreaField } from '../../components/form-field';
import { Button } from '../../components/ui/button';
import { useAddStory, type StudioBlock, type StudioSession } from './queries';
import { StudioError } from './studio-error';

const textName = 'content/text';

export function AddStoryForm({
    sessionId,
    after,
    onClose,
    onAdded,
}: {
    sessionId: number;
    after: StudioBlock;
    onClose: () => void;
    onAdded: (next: StudioSession) => void;
}) {
    const add = useAddStory(sessionId);
    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault();
                if (add.isPending) return;
                const text = new FormData(event.currentTarget).get(textName);
                add.mutate(
                    { after: after.id, text: String(text ?? '') },
                    { onSuccess: onAdded },
                );
            }}
        >
            <TextAreaField
                name={textName}
                id={`screen-${after.id}-new-text`}
                label="Teks layar cerita"
                hint="Paling banyak dua kalimat."
                rows={3}
                required
                autoFocus
                error={add.error}
            />
            <StudioError error={add.error} inline={[textName]} />
            <div className="flex flex-wrap gap-3">
                <Button
                    type="submit"
                    aria-disabled={add.isPending}
                    className="aria-disabled:opacity-60"
                >
                    {add.isPending ? 'Menyimpan…' : 'Simpan layar'}
                </Button>
                <Button
                    variant="outline"
                    disabled={add.isPending}
                    onClick={onClose}
                >
                    Batal
                </Button>
            </div>
        </form>
    );
}
