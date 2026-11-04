import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function AlertIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16.5h.01" />
        </Icon>
    );
}
