export type MaterialPage = { number: number; text: string };

export type ModuleInfo = {
    title: string;
    /** The subject's name, as teachers see it. */
    subject: string;
    /** Whether the subject counts and measures; left out, the header says nothing about it. */
    numeric?: boolean;
    grade: number | null;
};

const asData = (text: string) => text.replace(/<\/?material>/gi, '(material)');

export function moduleHeader(module: ModuleInfo) {
    return [
        `Module: ${module.title}`,
        `Subject: ${module.subject}`,
        ...(module.numeric === undefined
            ? []
            : [
                  `Subject kind: ${module.numeric ? 'numbers' : 'words and ideas'}`,
              ]),
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
