import type { helpKind } from '../db/schema.ts';

export type HelpEvent = {
    blockId: number;
    kind: (typeof helpKind.enumValues)[number];
    given: boolean;
    at: Date;
};

export function helpBetween(
    help: HelpEvent[],
    blockId: number,
    from: Date | null,
    before: Date | null,
    given?: boolean,
) {
    return help
        .filter(
            (event) =>
                event.blockId === blockId &&
                (from === null || event.at >= from) &&
                (before === null || event.at < before) &&
                (given === undefined || event.given === given),
        )
        .map(({ kind }) => kind);
}
