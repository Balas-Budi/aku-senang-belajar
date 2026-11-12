import { createContext, useContext } from 'react';
import type { Adaptation } from './queries';

export const AdaptationContext = createContext<Adaptation | null>(null);

export const MissionReadAloudContext = createContext(false);

export function useLead() {
    return useContext(AdaptationContext)?.lead ?? null;
}

export function useMissionReadAloud() {
    return useContext(MissionReadAloudContext);
}
