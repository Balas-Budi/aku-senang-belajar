import { SpeakerIcon } from '../../components/icons/speaker-icon';
import { requestErrorMessage } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import { useLead } from '../learning-sessions/adaptation';
import { useIndonesianVoice } from '../narration/narration';
import { speak } from '../narration/speech';
import {
    type LearningSettings,
    type SpeechRate,
    type TextSize,
    useLearningSettings,
    useSaveSettings,
} from './queries';

const sizes: { value: TextSize; label: string; sample: string }[] = [
    { value: 'normal', label: 'Biasa', sample: 'text-xl' },
    { value: 'large', label: 'Besar', sample: 'text-2xl' },
    { value: 'larger', label: 'Sangat besar', sample: 'text-3xl' },
];

const rates: { value: SpeechRate; label: string }[] = [
    { value: 0.75, label: 'Pelan' },
    { value: 1, label: 'Biasa' },
    { value: 1.25, label: 'Cepat' },
];

const choice =
    'border-border text-primary-deep has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-ring relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-b-[5px] bg-white px-2 py-3 text-center font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2';
const legend = 'font-display text-primary-deep mb-3 text-xl font-semibold';

export function LearningSettingsForm() {
    const settings = useLearningSettings();
    const save = useSaveSettings();
    const showError = useErrorToast();
    const voice = useIndonesianVoice();
    const lead = useLead();
    const change = (next: Partial<LearningSettings>) =>
        save.mutate(
            { ...settings, ...next },
            { onError: (error) => showError(requestErrorMessage(error)) },
        );

    return (
        <div className="space-y-7">
            <fieldset>
                <legend className={legend}>Ukuran teks</legend>
                <div className="grid grid-cols-3 gap-3">
                    {sizes.map((size) => (
                        <label key={size.value} className={choice}>
                            <input
                                type="radio"
                                name="text-size"
                                value={size.value}
                                checked={settings.textSize === size.value}
                                onChange={() =>
                                    change({ textSize: size.value })
                                }
                                className="sr-only"
                            />
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'font-display leading-none',
                                    size.sample,
                                )}
                            >
                                Aa
                            </span>
                            <span className="leading-tight">{size.label}</span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <label className="border-border relative flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-b-[5px] bg-white p-4">
                <span>
                    <span className="font-display text-primary-deep block text-xl font-semibold">
                        Bacakan otomatis
                    </span>
                    <span className="text-muted-foreground block leading-relaxed">
                        Setiap layar misi langsung dibacakan.
                    </span>
                </span>
                <input
                    type="checkbox"
                    role="switch"
                    checked={
                        settings.readAloud ||
                        (lead === 'audio' && !settings.readAloudChosen)
                    }
                    onChange={(event) =>
                        change({
                            readAloud: event.target.checked,
                            readAloudChosen: true,
                        })
                    }
                    className="peer sr-only"
                />
                <span
                    aria-hidden="true"
                    className="bg-border peer-checked:bg-primary peer-focus-visible:outline-ring relative h-8 w-14 shrink-0 rounded-full transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-6"
                />
            </label>
            <fieldset>
                <legend className={legend}>Kecepatan suara</legend>
                <div className="grid grid-cols-3 gap-3">
                    {rates.map((rate) => (
                        <label key={rate.value} className={choice}>
                            <input
                                type="radio"
                                name="speech-rate"
                                value={rate.value}
                                checked={settings.speechRate === rate.value}
                                onChange={() =>
                                    change({ speechRate: rate.value })
                                }
                                className="sr-only"
                            />
                            {rate.label}
                        </label>
                    ))}
                </div>
            </fieldset>
            {voice === null ? (
                <p className="bg-student-accent-soft text-student-accent-ink rounded-2xl px-4 py-3 leading-relaxed font-semibold">
                    Suara Bahasa Indonesia belum ada di perangkat ini, jadi misi
                    belum bisa dibacakan di sini.
                </p>
            ) : (
                <Button
                    variant="outline"
                    disabled={!voice}
                    onClick={() => {
                        if (voice)
                            speak(
                                'settings-sample',
                                ['Halo! Begini suara yang membacakan misimu.'],
                                0,
                                settings.speechRate,
                                voice,
                            );
                    }}
                >
                    <SpeakerIcon />
                    Coba dengarkan
                </Button>
            )}
        </div>
    );
}
