import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function ArrowLeftIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M19 12H5m6-6-6 6 6 6" />
        </Icon>
    );
}
export function ArrowRightIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M5 12h14m-6-6 6 6-6 6" />
        </Icon>
    );
}
