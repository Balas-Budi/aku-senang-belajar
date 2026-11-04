import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { meQuery, roleHome } from '../features/auth/queries';
import { ChangePasswordForm } from '../features/auth/change-password-form';
import { LogoutEverywhere } from '../features/auth/logout-everywhere';
import { DeleteAccount } from '../features/auth/delete-account';
export const meta = () => [{ title: 'Pengaturan akun | Aku Senang Belajar' }];
export default function AccountHome() {
    const { data: user } = useQuery(meQuery());
    if (!user) return null;
    const student = user.role === 'student';
    return (
        <div className="mx-auto max-w-xl space-y-6">
            <Link
                to={roleHome(user.role)}
                className="text-primary inline-block min-h-11 py-3 font-semibold underline"
            >
                Kembali ke ruangmu
            </Link>
            <h1
                className={
                    student
                        ? 'font-display text-primary-deep text-3xl font-semibold sm:text-4xl'
                        : 'text-primary-deep text-3xl font-bold'
                }
            >
                Pengaturan akun
            </h1>
            <ChangePasswordForm />
            <LogoutEverywhere student={student} />
            {!student && <DeleteAccount user={user} />}
        </div>
    );
}
