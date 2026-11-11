import { createContext, useContext } from 'react';
import type { Adaptation } from './queries';

export const AdaptationContext = createContext<Adaptation | null>(null);

export function useLead() {
    return useContext(AdaptationContext)?.lead ?? null;
}
