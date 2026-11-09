import { Link } from 'react-router';
import { textLink } from '../components/ui/text-link';
import { LearningSettingsForm } from '../features/settings/learning-settings';
export const meta = () => [
    { title: 'Pengaturan belajar | Aku Senang Belajar' },
];
export default function StudentSettings() {
    return (
        <div className="space-y-6">
            <Link to="/student" className={textLink}>
                Kembali ke beranda
            </Link>
            <section
                aria-labelledby="settings-title"
                className="border-paper-edge mx-auto max-w-3xl space-y-6 rounded-[28px] border-2 border-b-[6px] bg-white p-5 sm:p-8"
            >
                <div>
                    <h1
                        id="settings-title"
                        className="font-display text-primary-deep text-3xl font-semibold sm:text-4xl"
                    >
                        Pengaturan belajar
                    </h1>
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                        Atur ukuran teks dan suara yang membacakan misimu.
                        Pilihanmu langsung tersimpan.
                    </p>
                </div>
                <LearningSettingsForm />
            </section>
        </div>
    );
}
