import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function HelpIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6M12 16.8v.2" />
        </Icon>
    );
}
