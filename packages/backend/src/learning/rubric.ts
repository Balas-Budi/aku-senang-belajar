import { z } from 'zod';

const indicator = z.string().trim().min(1).max(300);

export const competencyRubric = z.object({
    visible: z.array(indicator).min(1).max(4),
    developing: z.array(indicator).min(1).max(4),
    notEnough: z.array(indicator).min(1).max(3),
});

export type CompetencyRubric = z.infer<typeof competencyRubric>;
