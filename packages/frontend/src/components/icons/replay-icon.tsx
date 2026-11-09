import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function ReplayIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
            <path d="M4.5 4.5v3.7h3.7" />
        </Icon>
    );
}
