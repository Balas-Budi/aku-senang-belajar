import type { ComponentProps } from 'react';
import { Icon } from './icon';
export function EyeIcon({
    concealed,
    ...props
}: ComponentProps<'svg'> & { concealed: boolean }) {
    return (
        <Icon {...props}>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle
                cx="12"
                cy="12"
                r="3"
                className="origin-center transition-transform duration-200 motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"
            />
            <path
                d="M4 4l16 16"
                className={
                    concealed
                        ? 'opacity-100 transition-opacity duration-150'
                        : 'opacity-0 transition-opacity duration-150'
                }
            />
        </Icon>
    );
}
