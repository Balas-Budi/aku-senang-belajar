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
        route('settings', 'routes/student-settings.tsx'),
        route('cards', 'routes/student-cards.tsx'),
        route('challenge', 'routes/student-challenge.tsx'),
        route('subjects/:subject', 'routes/student-subject.tsx'),
        route('subjects/:subject/review', 'routes/student-review.tsx'),
        route('subjects/:subject/extra', 'routes/student-extra.tsx'),
        route('chapters/:chapterId', 'routes/student-chapter.tsx'),
        route('follow-ups/:followUpId', 'routes/student-follow-up.tsx'),
    ]),
    route('student/sessions/:assignmentId', 'routes/student-session.tsx'),
    route('teacher', 'routes/teacher-layout.tsx', [
        index('routes/teacher-home.tsx'),
        route('classes', 'routes/teacher-classes.tsx'),
        route('classes/:classId', 'routes/teacher-class.tsx'),
        route('classes/:classId/follow-ups', 'routes/teacher-follow-ups.tsx'),
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
        route(
            'classes/:classId/chapters/:moduleId',
            'routes/teacher-chapter-report.tsx',
        ),
        route(
            'classes/:classId/students/:studentId',
            'routes/teacher-student-report.tsx',
        ),
    ]),
    route('admin', 'routes/admin-layout.tsx', [
        index('routes/admin-home.tsx'),
        route('subjects', 'routes/admin-subjects.tsx'),
    ]),
    route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
