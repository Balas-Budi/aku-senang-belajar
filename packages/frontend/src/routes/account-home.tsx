import { useQuery } from '@tanstack/react-query';
import { StudentNavLink } from '../components/student-nav-link';
import { meQuery, roleHome } from '../features/auth/queries';
import { ChangePasswordForm } from '../features/auth/change-password-form';
import { LogoutEverywhere } from '../features/auth/logout-everywhere';
import { DeleteAccount } from '../features/auth/delete-account';
import { Card } from '../components/ui/card';
export const meta = () => [{ title: 'Pengaturan akun | Aku Senang Belajar' }];
export default function AccountHome() {
    const { data: user } = useQuery(meQuery());
    if (!user) return null;
    if (user.role === 'student')
        return (
            <div className="mx-auto max-w-xl space-y-6">
                <StudentNavLink back to={roleHome(user.role)}>
                    Kembali ke beranda
                </StudentNavLink>
                <h1 className="font-display text-primary-deep text-3xl font-semibold sm:text-4xl">
                    Pengaturan akun
                </h1>
                <ChangePasswordForm />
                <LogoutEverywhere student />
            </div>
        );
    return (
        <div className="max-w-2xl space-y-6">
            <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                Pengaturan akun
            </h1>
            <Card className="space-y-6 sm:p-6">
                <ChangePasswordForm />
                <LogoutEverywhere student={false} />
                <DeleteAccount user={user} />
            </Card>
        </div>
    );
}
