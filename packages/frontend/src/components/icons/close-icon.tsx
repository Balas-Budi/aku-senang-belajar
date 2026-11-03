import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function CloseIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M6 6l12 12M18 6 6 18" />
        </Icon>
    );
}
