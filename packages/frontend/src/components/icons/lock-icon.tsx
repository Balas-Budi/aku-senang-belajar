import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function LockIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
        </Icon>
    );
}
