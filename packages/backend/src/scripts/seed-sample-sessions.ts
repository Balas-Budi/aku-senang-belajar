import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase, type Queryable } from '../db/index.ts';
import {
    assignments,
    classes,
    learningSessions,
    materials,
    modules,
} from '../db/schema.ts';
import { loadEnv } from '../env.ts';

type Sample = {
    subject: typeof materials.$inferInsert.subject;
    material: string;
    module: string;
    sessions: { title: string; summary: string }[];
};

const SAMPLES: Sample[] = [
    {
        subject: 'mathematics',
        material: 'Contoh materi Matematika Kelas 5',
        module: 'Pecahan',
        sessions: [
            {
                title: 'Mengenal pecahan',
                summary:
                    'Membagi roti menjadi bagian yang sama besar, lalu menuliskannya sebagai pecahan.',
            },
            {
                title: 'Pembilang dan penyebut',
                summary: 'Arti angka di atas dan di bawah garis pecahan.',
            },
        ],
    },
    {
        subject: 'natural_and_social_science',
        material: 'Contoh materi IPAS Kelas 5',
        module: 'Ekosistem',
        sessions: [
            {
                title: 'Rantai makanan di sekitar kita',
                summary:
                    'Siapa memakan siapa di sawah, dan apa yang terjadi kalau salah satunya hilang.',
            },
            {
                title: 'Produsen, konsumen, dan pengurai',
                summary:
                    'Peran tiap makhluk hidup dalam menjaga ekosistem tetap seimbang.',
            },
        ],
    },
    {
        subject: 'indonesian_language',
        material: 'Contoh materi Bahasa Indonesia Kelas 5',
        module: 'Membaca paragraf',
        sessions: [
            {
                title: 'Menemukan ide pokok',
                summary:
                    'Mencari kalimat utama dalam paragraf, lalu menceritakannya dengan kata-katamu sendiri.',
            },
        ],
    },
    {
        subject: 'pancasila_education',
        material: 'Contoh materi Pendidikan Pancasila Kelas 5',
        module: 'Musyawarah',
        sessions: [
            {
                title: 'Musyawarah di kelas',
                summary:
                    'Mengambil keputusan bersama dengan adil, misalnya saat memilih ketua kelas.',
            },
        ],
    },
];

const classId = z.coerce.number().int().positive().safeParse(process.argv[2]);

if (!classId.success) {
    console.error(
        'Usage: npm exec nx run backend:seed-sample-sessions -- <class id>',
    );
    process.exit(1);
}

async function sampleSessions(tx: Queryable, sample: Sample) {
    const existing = await tx
        .select({ id: learningSessions.id })
        .from(learningSessions)
        .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
        .innerJoin(materials, eq(materials.id, modules.materialId))
        .where(
            and(
                eq(materials.subject, sample.subject),
                eq(materials.title, sample.material),
            ),
        )
        .orderBy(learningSessions.id);

    if (existing.length > 0) {
        return existing;
    }

    const [material] = await tx
        .insert(materials)
        .values({ subject: sample.subject, title: sample.material })
        .returning({ id: materials.id });
    const [chapter] = await tx
        .insert(modules)
        .values({ materialId: material.id, title: sample.module })
        .returning({ id: modules.id });

    return tx
        .insert(learningSessions)
        .values(
            sample.sessions.map((session) => ({
                ...session,
                moduleId: chapter.id,
                status: 'ready' as const,
            })),
        )
        .returning({ id: learningSessions.id });
}

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);

try {
    const [classroom] = await db
        .select({ name: classes.name })
        .from(classes)
        .where(eq(classes.id, classId.data));

    if (!classroom) {
        console.error(`Class ${classId.data} does not exist`);
        process.exitCode = 1;
    } else {
        const assigned = await db.transaction(async (tx) => {
            const sessions: { id: number }[] = [];

            for (const sample of SAMPLES) {
                sessions.push(...(await sampleSessions(tx, sample)));
            }

            return tx
                .insert(assignments)
                .values(
                    sessions.map(({ id }) => ({
                        learningSessionId: id,
                        classId: classId.data,
                    })),
                )
                .onConflictDoNothing()
                .returning({ id: assignments.id });
        });

        console.log(
            `${assigned.length} sample sessions assigned to ${classroom.name}`,
        );
    }
} finally {
    await pool.end();
}
