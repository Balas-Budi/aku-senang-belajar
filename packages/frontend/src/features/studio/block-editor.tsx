import {
    diagramFields,
    fieldName,
    samePath,
    textAt,
    textFields,
    withTexts,
    type EditableBlock,
} from './block-fields';
import { DiagramFigure } from './diagram-figure';
import type { ThemeScreen } from './queries';
import { StudioError } from './studio-error';
import {
    FormField,
    TextAreaField,
    fieldErrorText,
} from '../../components/form-field';
import { Button } from '../../components/ui/button';

const answerName = 'content/answer';

export type BlockSave = {
    mutate(input: ThemeScreen, options: { onSuccess: () => void }): void;
    isPending: boolean;
    error: Error | null;
};

export function BlockEditor({
    block,
    save,
    idPrefix,
    answerFixed = false,
    onClose,
}: {
    block: EditableBlock;
    save: BlockSave;
    idPrefix: string;
    answerFixed?: boolean;
    onClose: () => void;
}) {
    const fields = textFields(block);
    const diagrams = diagramFields(block);
    const idOf = (name: string) => `${idPrefix}-${name}`;
    const answer =
        !answerFixed && 'answer' in block.content ? block.content.answer : null;
    const options = 'options' in block.content ? block.content.options : [];
    const answerError = fieldErrorText(save.error, answerName);
    const contentError = fieldErrorText(save.error, 'content');
    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const content = withTexts(block.content, fields, (field) =>
                    String(form.get(fieldName(field)) ?? ''),
                );
                if (answer !== null)
                    content.answer = String(form.get(answerName) ?? answer);
                save.mutate(
                    { blockId: block.id, content },
                    { onSuccess: onClose },
                );
            }}
        >
            {fields.map((field) => {
                const name = fieldName(field);
                const props = {
                    name,
                    id: idOf(name),
                    label: field.label,
                    defaultValue: textAt(block.content, field),
                    required: true,
                    error: save.error,
                };
                return (
                    <div key={name}>
                        {field.long ? (
                            <TextAreaField {...props} />
                        ) : (
                            <FormField {...props} />
                        )}
                        {diagrams
                            .filter((d) => samePath(d.under, field.path))
                            .map((d) => (
                                <DiagramFigure
                                    key={d.path.join('/')}
                                    name={d.name}
                                    screen={block.position}
                                    diagram={d.diagram}
                                />
                            ))}
                    </div>
                );
            })}
            {answer !== null && (
                <fieldset
                    className="space-y-2"
                    aria-describedby={
                        answerError ? `${idOf(answerName)}-error` : undefined
                    }
                >
                    <legend className="font-medium">Jawaban benar</legend>
                    <div className="flex flex-wrap gap-3">
                        {options.map((option, index) => (
                            <label
                                key={option.id}
                                className="border-border has-[:checked]:border-primary has-[:checked]:bg-secondary flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3"
                            >
                                <input
                                    type="radio"
                                    name={answerName}
                                    value={option.id}
                                    defaultChecked={option.id === answer}
                                    className="accent-primary focus-visible:outline-ring size-5 shrink-0 focus-visible:outline-3 focus-visible:outline-offset-2"
                                />
                                Pilihan {index + 1}
                            </label>
                        ))}
                    </div>
                    {answerError && (
                        <p
                            id={`${idOf(answerName)}-error`}
                            className="text-destructive"
                        >
                            {answerError}
                        </p>
                    )}
                </fieldset>
            )}
            {contentError ? (
                <p role="alert" className="text-destructive">
                    {contentError}
                </p>
            ) : (
                <StudioError
                    error={save.error}
                    inline={[...fields.map(fieldName), answerName, 'content']}
                />
            )}
            <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? 'Menyimpan…' : 'Simpan teks'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                    Batal
                </Button>
            </div>
        </form>
    );
}
