import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function PlayIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M8 5.5v13l10-6.5z" />
        </Icon>
    );
}
