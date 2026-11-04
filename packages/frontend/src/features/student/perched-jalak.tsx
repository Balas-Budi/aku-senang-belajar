import { useEffect, useRef, useState, type RefObject } from 'react';
import { JalakBali, useJalakMotion } from '../../components/jalak-bali';
import { LottieMoment } from '../../components/lottie-moment';
import { SpeechBubble, useSpeech } from '../../components/ui/speech-bubble';
export function PerchedJalak({
    watching = false,
    lookAt,
    cheers = 0,
}: {
    watching?: boolean;
    lookAt?: RefObject<HTMLElement | null>;
    cheers?: number;
}) {
    const figure = useRef<SVGSVGElement>(null);
    const [chirps, setChirps] = useState(0);
    const [message, say] = useSpeech();
    const ready = useJalakMotion(figure, {
        perched: true,
        watching,
        lookAt,
        cheers,
        chirps,
    });
    useEffect(() => {
        if (cheers) say('Yeay, kamu sudah masuk kelas!', 2600);
    }, [cheers, say]);
    return (
        <div className="pointer-events-none absolute -top-[104px] left-3 z-1 w-[108px] sm:-top-[131px] sm:left-7 sm:w-[136px]">
            <JalakBali ref={figure} perched className="w-full" />
            {chirps > 0 && (
                <LottieMoment
                    key={chirps}
                    path="/lottie/chirp.json"
                    className="absolute top-0 left-[16.7%] aspect-[8/7] w-[66.7%]"
                />
            )}
            <SpeechBubble
                message={message}
                className="bottom-[62%] left-[86%]"
            />
            {ready && (
                <button
                    type="button"
                    aria-label="Sapa jalak bali"
                    onClick={() => {
                        setChirps((count) => count + 1);
                        say('Cuit, cuit! Ayo belajar bareng.', 2000);
                    }}
                    className="focus-visible:outline-ring pointer-events-auto absolute top-[14%] left-[20%] h-[76%] w-[60%] cursor-pointer rounded-full focus-visible:outline-3 focus-visible:outline-offset-2"
                />
            )}
        </div>
    );
}
