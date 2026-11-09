import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function SpeakerIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </Icon>
    );
}
