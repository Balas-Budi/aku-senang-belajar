import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAnswer, type AnswerInput, type Feedback } from './queries';
import { useActionError } from './session-ui';

type Sending = { input: AnswerInput; then: (feedback: Feedback) => void };

export function useAnswerSender(assignmentId: number) {
    const { mutate, isPending, isPaused } = useAnswer(assignmentId);
    const showError = useActionError();
    const [waiting, setWaiting] = useState(false);
    const last = useRef<Sending | null>(null);

    const send = useCallback(
        (input: AnswerInput, then: (feedback: Feedback) => void) => {
            last.current = { input, then };
            mutate(input, {
                onSuccess: (feedback) => {
                    last.current = null;
                    setWaiting(false);
                    then(feedback);
                },
                onError: (error) => {
                    if (error instanceof ApiError) {
                        last.current = null;
                        setWaiting(false);
                        showError(error);
                    } else setWaiting(true);
                },
            });
        },
        [mutate, showError],
    );

    const resend = useCallback(() => {
        if (last.current) send(last.current.input, last.current.then);
    }, [send]);

    useEffect(() => {
        if (!waiting) return;
        window.addEventListener('online', resend);
        return () => window.removeEventListener('online', resend);
    }, [waiting, resend]);

    return {
        send,
        sending: isPending,
        offline: waiting || isPaused,
        retry: waiting ? resend : undefined,
    };
}
