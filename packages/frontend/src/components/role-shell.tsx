import { useState } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { meQuery, useLogout, type Role } from '../features/auth/queries';
import { classesQuery } from '../features/classes/queries';
import { Button } from './ui/button';
import { ToastProvider } from './ui/toast';
import { RequestError } from './request-error';
import { WorkspaceShell, type WorkspaceLink } from './workspace-shell';
import { StudentShell } from '../features/student/student-shell';

function useWorkspaceLinks(role: Role): WorkspaceLink[] {
    const location = useLocation();
    const openClass = useMatch('/teacher/classes/:classId/*');
    const classes = useQuery({
        ...classesQuery(),
        enabled: role === 'teacher',
    });

    if (role === 'admin') {
        const params = new URLSearchParams(location.search);
        const shown = params.get('role') === 'teacher' ? 'teacher' : 'student';
        const onAccounts = location.pathname === '/admin';
        const filtered = params.get('filter') === 'no-class';

        return [
            {
                to: '/admin?role=student',
                label: 'Akun siswa',
                current:
                    onAccounts && shown === 'student'
                        ? filtered
                            ? 'within'
                            : 'page'
                        : false,
            },
            {
                to: '/admin?role=teacher',
                label: 'Akun guru',
                current: onAccounts && shown === 'teacher' ? 'page' : false,
            },
        ];
    }

    const classId = Number(openClass?.params.classId);
    const classroom = classes.data?.find(({ id }) => id === classId);
    const classPath = `/teacher/classes/${classId}`;

    return [
        {
            to: '/teacher',
            label: 'Beranda',
            current: location.pathname === '/teacher' ? 'page' : false,
        },
        {
            to: '/teacher/classes',
            label: 'Kelas',
            current: location.pathname === '/teacher/classes' ? 'page' : false,
            nested: classroom
                ? [
                      {
                          to: classPath,
                          label: classroom.name,
                          current:
                              location.pathname === classPath
                                  ? 'page'
                                  : 'within',
                      },
                  ]
                : [],
        },
    ];
}

export function RoleShell({ role }: { role: Role }) {
    const query = useQuery(meQuery());
    const logout = useLogout();
    const navigate = useNavigate();
    const links = useWorkspaceLinks(role);
    const [help, setHelp] = useState(false);
    const user = query.data;
    const leave = () =>
        logout.mutate(undefined, {
            onSuccess: () => {
                void navigate('/login', { replace: true });
            },
        });
    if (!user)
        return (
            <main className="mx-auto max-w-xl space-y-4 p-8">
                {query.isError ? (
                    <>
                        <RequestError error={query.error} />
                        <Button
                            onClick={() => {
                                void query.refetch();
                            }}
                        >
                            Muat ulang akun
                        </Button>
                    </>
                ) : (
                    <p role="status">Memuat ruangmu…</p>
                )}
            </main>
        );
    if (role === 'student')
        return (
            <ToastProvider>
                <StudentShell
                    name={user.name}
                    pending={logout.isPending}
                    error={logout.error}
                    onLogout={leave}
                >
                    <Outlet />
                </StudentShell>
            </ToastProvider>
        );
    return (
        <WorkspaceShell
            area={role === 'teacher' ? 'Ruang guru' : 'Administrasi sekolah'}
            links={links}
            userName={user.name}
            pending={logout.isPending}
            onLogout={leave}
        >
            <RequestError error={logout.error} />
            <Outlet />
            <footer className="border-paper-edge text-muted-foreground border-t pt-6">
                <button
                    type="button"
                    className="focus-visible:outline-ring min-h-12 underline underline-offset-4 focus-visible:outline-3"
                    aria-expanded={help}
                    onClick={() => setHelp(!help)}
                >
                    Butuh bantuan akun?
                </button>
                {help && (
                    <p className="mt-2">
                        Minta bantuan admin sekolah untuk membuat akun atau
                        mengatur ulang kata sandi.
                    </p>
                )}
            </footer>
        </WorkspaceShell>
    );
}
