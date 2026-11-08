import { index, route, type RouteConfig } from '@react-router/dev/routes';
export default [
    index('routes/home.tsx'),
    route('login', 'routes/login.tsx'),
    route('account', 'routes/account-layout.tsx', [
        index('routes/account-home.tsx'),
    ]),
    route('student', 'routes/student-layout.tsx', [
        index('routes/student-home.tsx'),
        route('profile', 'routes/student-profile.tsx'),
        route('subjects/:subject', 'routes/student-subject.tsx'),
        route('chapters/:chapterId', 'routes/student-chapter.tsx'),
    ]),
    route('student/sessions/:assignmentId', 'routes/student-session.tsx'),
    route('teacher', 'routes/teacher-layout.tsx', [
        index('routes/teacher-home.tsx'),
        route('classes', 'routes/teacher-classes.tsx'),
        route('classes/:classId', 'routes/teacher-class.tsx'),
        route('materials', 'routes/teacher-materials.tsx'),
        route('materials/:materialId', 'routes/teacher-material.tsx'),
        route('studio/:sessionId', 'routes/teacher-studio.tsx'),
        route(
            'classes/:classId/sessions/:assignmentId',
            'routes/teacher-session.tsx',
        ),
        route(
            'classes/:classId/sessions/:assignmentId/students/:studentId',
            'routes/teacher-evidence.tsx',
        ),
    ]),
    route('admin', 'routes/admin-layout.tsx', [index('routes/admin-home.tsx')]),
    route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
