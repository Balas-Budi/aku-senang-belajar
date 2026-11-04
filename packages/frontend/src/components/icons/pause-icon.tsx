import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function PauseIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M9 5.5v13M15 5.5v13" />
        </Icon>
    );
}
