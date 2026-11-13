import type { ComponentProps } from 'react';
import { Icon } from './icon';

type Props = ComponentProps<'svg'>;

export function HomeIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
        </Icon>
    );
}
export function ClassIcon(props: Props) {
    return (
        <Icon {...props}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
            <circle cx="17" cy="9" r="2.4" />
            <path d="M15.8 14.2c2.4-.3 4.3 1.2 4.7 4.3" />
        </Icon>
    );
}
export function BookIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5z" />
            <path d="M12 6.5v13" />
        </Icon>
    );
}
export function StudentIcon(props: Props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" />
        </Icon>
    );
}
export function TeacherIcon(props: Props) {
    return (
        <Icon {...props}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
            <path d="M14 4.5h6.5v7H16" />
            <path d="m15.5 9 2-2" />
        </Icon>
    );
}
export function SettingsIcon(props: Props) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
        </Icon>
    );
}
export function LogoutIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
            <path d="m15 8 4 4-4 4M19 12H9" />
        </Icon>
    );
}
export function MenuIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M4 7h16M4 12h16M4 17h16" />
        </Icon>
    );
}
export function SparkleIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.5l-1.8-5.7L4.5 11l5.7-1.9z" />
            <path d="M18.5 3.5v3M17 5h3" />
        </Icon>
    );
}
export function HourglassIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M7 3.5h10M7 20.5h10" />
            <path d="M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5" />
        </Icon>
    );
}
export function SendIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z" />
        </Icon>
    );
}
export function PlusIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M12 5v14M5 12h14" />
        </Icon>
    );
}
export function UploadIcon(props: Props) {
    return (
        <Icon {...props}>
            <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5" />
            <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
        </Icon>
    );
}
