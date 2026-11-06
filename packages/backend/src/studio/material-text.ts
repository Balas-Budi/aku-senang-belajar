import type { subject } from '../db/schema.ts';

export type MaterialPage = { number: number; text: string };

export type ModuleInfo = {
    title: string;
    subject: (typeof subject.enumValues)[number];
    grade: number | null;
};

const subjectNames: Record<ModuleInfo['subject'], string> = {
    mathematics: 'Matematika',
    natural_and_social_science: 'IPAS',
    indonesian_language: 'Bahasa Indonesia',
    pancasila_education: 'Pendidikan Pancasila',
};

const asData = (text: string) => text.replace(/<\/?material>/gi, '(material)');

export function moduleHeader(module: ModuleInfo) {
    return [
        `Module: ${module.title}`,
        `Subject: ${subjectNames[module.subject]}`,
        `Grade: ${module.grade ?? 'not given'}`,
    ];
}

export function materialSection(pages: MaterialPage[]) {
    return [
        '<material>',
        ...pages.map((page) => `[Page ${page.number}]\n${asData(page.text)}`),
        '</material>',
    ];
}
