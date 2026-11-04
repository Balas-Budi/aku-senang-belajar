import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function CheckIcon(props: ComponentProps<'svg'>) {
    return (
        <Icon {...props}>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
        </Icon>
    );
}
