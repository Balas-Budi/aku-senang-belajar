import {
    queryOptions,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';

export type TextSize = 'normal' | 'large' | 'larger';
export type SpeechRate = 0.75 | 1 | 1.25;
export type LearningSettings = {
    textSize: TextSize;
    readAloud: boolean;
    speechRate: SpeechRate;
    readAloudChosen: boolean;
};

export const DEFAULT_SETTINGS: LearningSettings = {
    textSize: 'normal',
    readAloud: false,
    speechRate: 1,
    readAloudChosen: false,
};

const settingsKey = ['student', 'settings'];

export const studentSettingsQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: settingsKey,
        queryFn: () =>
            api<LearningSettings>('/api/student/settings', {
                headers: cookie ? { cookie } : undefined,
            }),
        staleTime: Infinity,
    });

export function useLearningSettings() {
    return useQuery(studentSettingsQuery()).data ?? DEFAULT_SETTINGS;
}

export function useSaveSettings() {
    const client = useQueryClient();
    return useMutation({
        scope: { id: 'student-settings' },
        mutationFn: (settings: LearningSettings) =>
            api<LearningSettings>('/api/student/settings', {
                method: 'PUT',
                body: JSON.stringify(settings),
            }),
        onMutate: async (settings) => {
            await client.cancelQueries({ queryKey: settingsKey });
            const before = client.getQueryData<LearningSettings>(settingsKey);
            client.setQueryData(settingsKey, settings);
            return { before };
        },
        onError: (_error, _settings, context) =>
            client.setQueryData(settingsKey, context?.before),
        onSettled: () => client.invalidateQueries({ queryKey: settingsKey }),
    });
}
