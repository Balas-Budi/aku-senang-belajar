import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckIcon } from '../../components/icons/check-icon';
import { Sticker } from '../../components/sticker';
import { Button, buttonVariants } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import {
    RequestError,
    requestErrorMessage,
} from '../../components/request-error';
import { GreetingJalak } from '../auth/greeting-jalak';
import { interests, type Interest } from './interests';
import { studentProfileQuery, useSaveProfile } from './queries';
export function InterestPicker() {
    const query = useQuery(studentProfileQuery());
    const save = useSaveProfile();
    const navigate = useNavigate();
    const showError = useErrorToast();
    const [cheers, setCheers] = useState(0);
    const [saved, setSaved] = useState(false);
    if (query.isPending)
        return (
            <p
                role="status"
                className="border-paper-edge rounded-[24px] border-2 bg-white p-8"
            >
                Sebentar, kita siapkan pilihannya…
            </p>
        );
    if (query.isLoadingError)
        return (
            <div className="border-paper-edge space-y-4 rounded-[24px] border-2 bg-white p-6">
                <RequestError error={query.error} />
                <Button
                    feel="chunky"
                    onClick={() => {
                        void query.refetch();
                    }}
                >
                    Muat ulang
                </Button>
            </div>
        );
    const profile = query.data.profile;
    const first = profile === null;
    const keep = (chosen: Interest[]) =>
        save.mutate(chosen, {
            onSuccess: () => {
                if (first) {
                    void navigate('/student');
                    return;
                }
                setSaved(true);
                setCheers((count) => count + 1);
            },
            onError: (error) => showError(requestErrorMessage(error)),
        });
    return (
        <section
            aria-labelledby="profile-title"
            className="border-paper-edge mx-auto max-w-3xl space-y-6 rounded-[28px] border-2 border-b-[6px] bg-white p-5 sm:p-8"
        >
            <div className="flex flex-col-reverse items-start gap-4">
                <div>
                    <h1
                        id="profile-title"
                        className="font-display text-primary-deep text-3xl font-semibold sm:text-4xl"
                    >
                        {first ? 'Kenalan dulu, yuk!' : 'Minatku'}
                    </h1>
                    <p className="text-muted-foreground mt-2 leading-relaxed">
                        Pilih hal yang kamu suka, boleh lebih dari satu.
                        {first &&
                            ' Kamu bisa mengubahnya kapan saja dari menu Minatku.'}
                    </p>
                </div>
                <GreetingJalak
                    greeting="Cuit! Aku suka terbang dan bernyanyi."
                    cheers={cheers}
                    bubbleClassName="bottom-[62%] left-[72%]"
                    className="w-24 shrink-0 sm:w-28"
                />
            </div>
            <form
                className="space-y-6"
                onChange={(event) => {
                    setSaved(false);
                    if (
                        event.target instanceof HTMLInputElement &&
                        event.target.checked
                    )
                        setCheers((count) => count + 1);
                }}
                onSubmit={(event) => {
                    event.preventDefault();
                    const chosen = new FormData(event.currentTarget).getAll(
                        'interests',
                    );
                    keep(
                        interests
                            .map(({ key }) => key)
                            .filter((key) => chosen.includes(key)),
                    );
                }}
            >
                <fieldset>
                    <legend className="font-display text-primary-deep mb-3 text-xl font-semibold">
                        Aku suka…
                    </legend>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {interests.map((interest) => (
                            <label
                                key={interest.key}
                                className="group border-border text-primary-deep has-checked:border-primary has-checked:bg-secondary has-focus-visible:outline-ring relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-b-[5px] bg-white px-2 py-3 text-center has-focus-visible:outline-3 has-focus-visible:outline-offset-2"
                            >
                                <input
                                    type="checkbox"
                                    name="interests"
                                    value={interest.key}
                                    defaultChecked={profile?.interests.includes(
                                        interest.key,
                                    )}
                                    className="sr-only"
                                />
                                <Sticker
                                    tint={interest.tint}
                                    className="size-14 sm:size-16"
                                >
                                    {interest.drawing}
                                </Sticker>
                                <span className="font-display text-lg leading-tight font-semibold">
                                    {interest.label}
                                </span>
                                <span className="bg-primary text-primary-foreground absolute top-2 right-2 hidden size-7 items-center justify-center rounded-full group-has-checked:flex">
                                    <CheckIcon className="size-4" />
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                        type="submit"
                        feel="chunky"
                        disabled={save.isPending}
                    >
                        {save.isPending
                            ? 'Menyimpan…'
                            : first
                              ? 'Simpan pilihanku'
                              : 'Simpan perubahan'}
                    </Button>
                    {first ? (
                        <Button
                            feel="chunky"
                            variant="outline"
                            disabled={save.isPending}
                            onClick={() => keep([])}
                        >
                            Lewati dulu
                        </Button>
                    ) : (
                        <Link
                            to="/student"
                            className={buttonVariants({
                                variant: 'outline',
                                feel: 'chunky',
                            })}
                        >
                            Kembali ke beranda
                        </Link>
                    )}
                    <p role="status" className="text-primary-deep font-bold">
                        {saved ? 'Pilihanmu sudah disimpan.' : ''}
                    </p>
                </div>
            </form>
        </section>
    );
}
