import { useState, type ComponentProps } from 'react';
import { FormField } from '../../components/form-field';
import { EyeIcon } from '../../components/icons/eye-icon';
import { cn } from '../../lib/cn';

export function PasswordField({
    name,
    label,
    className,
    ...props
}: Omit<ComponentProps<typeof FormField>, 'type' | 'trailing'>) {
    const [visible, setVisible] = useState(false);
    const action = `${visible ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`;
    return (
        <FormField
            name={name}
            label={label}
            type={visible ? 'text' : 'password'}
            className={cn('pr-14', className)}
            {...props}
            trailing={
                <button
                    type="button"
                    aria-label={action}
                    title={action}
                    aria-controls={name}
                    aria-pressed={visible}
                    className="group text-muted-foreground hover:text-primary hover:bg-secondary focus-visible:outline-ring absolute inset-y-0 right-0.5 my-auto flex size-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-3 focus-visible:outline-offset-2"
                    onClick={() => setVisible(!visible)}
                >
                    <EyeIcon
                        concealed={visible}
                        className="size-[22px] transition-transform duration-200 motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"
                    />
                </button>
            }
        />
    );
}
