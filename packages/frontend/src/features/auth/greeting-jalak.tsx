import { useRef, useState, type RefObject } from 'react';
import { JalakBali, useJalakMotion } from '../../components/jalak-bali';
import { LottieMoment } from '../../components/lottie-moment';
import { SpeechBubble, useSpeech } from '../../components/ui/speech-bubble';
import { cn } from '../../lib/cn';
export function GreetingJalak({
    lookAt,
    watching = false,
    covering = false,
    greeting,
    bubbleClassName,
    className,
}: {
    lookAt?: RefObject<HTMLElement | null>;
    watching?: boolean;
    covering?: boolean;
    greeting: string;
    bubbleClassName: string;
    className?: string;
}) {
    const figure = useRef<SVGSVGElement>(null);
    const [chirps, setChirps] = useState(0);
    const [message, say] = useSpeech();
    const ready = useJalakMotion(figure, {
        watching,
        lookAt,
        covering,
        chirps,
    });
    return (
        <div className={cn('relative', className)}>
            <JalakBali ref={figure} className="w-full" />
            {chirps > 0 && (
                <LottieMoment
                    key={chirps}
                    path="/lottie/chirp.json"
                    className="absolute top-0 left-[16.7%] aspect-[8/7] w-[66.7%]"
                />
            )}
            <SpeechBubble message={message} className={bubbleClassName} />
            <SpeechBubble
                announce={false}
                message={covering ? 'Tenang, aku tidak mengintip.' : null}
                className={bubbleClassName}
            />
            {ready && (
                <button
                    type="button"
                    aria-label="Sapa jalak bali"
                    onClick={() => {
                        setChirps((count) => count + 1);
                        say(greeting, 2000);
                    }}
                    className="focus-visible:outline-ring absolute top-[8%] left-[18%] h-[80%] w-[64%] cursor-pointer rounded-full focus-visible:outline-3 focus-visible:outline-offset-2"
                />
            )}
        </div>
    );
}
