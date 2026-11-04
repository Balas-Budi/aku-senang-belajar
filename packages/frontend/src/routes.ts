import { index, route, type RouteConfig } from '@react-router/dev/routes';
export default [
    index('routes/home.tsx'),
    route('login', 'routes/login.tsx'),
    route('account', 'routes/account-layout.tsx', [
        index('routes/account-home.tsx'),
    ]),
    route('student', 'routes/student-layout.tsx', [
        index('routes/student-home.tsx'),
    ]),
    route('student/sessions/:assignmentId', 'routes/student-session.tsx'),
    route('teacher', 'routes/teacher-layout.tsx', [
        index('routes/teacher-home.tsx'),
        route('classes/:classId', 'routes/teacher-class.tsx'),
    ]),
    route('admin', 'routes/admin-layout.tsx', [index('routes/admin-home.tsx')]),
    route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
