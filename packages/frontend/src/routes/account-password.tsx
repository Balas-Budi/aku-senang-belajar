import { ChangePasswordForm } from '../features/auth/change-password-form';
export const meta = () => [{ title: 'Ganti kata sandi | Aku Senang Belajar' }];
export default function AccountPassword() {
    return <ChangePasswordForm />;
}
