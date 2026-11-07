import { demoModule } from './demo-module.ts';
import type { PreparedBook } from './seed-book.ts';

export const mathsBook: PreparedBook = {
    subject: 'mathematics',
    material: 'Contoh buku Matematika',
    grade: 5,
    chapters: [
        {
            title: 'Mengenal pecahan',
            competencies: [
                ...demoModule.competencies,
                {
                    code: 'C4',
                    description:
                        'Menyebut pembilang dan penyebut sebuah pecahan beserta artinya.',
                    rubric: {
                        visible: [
                            'Memilih 3 sebagai penyebut 1/3 dan memilih 1/4 untuk kertas berwarna pada percobaan pertama.',
                            'Di tantangan, menjelaskan bahwa 4 adalah banyak bagian yang sama besar, jadi ditulis di bawah garis.',
                        ],
                        developing: [
                            'Jawaban yang tepat baru tampil setelah memakai petunjuk.',
                            'Pembilang dan penyebut masih tertukar, misalnya memilih 4/1.',
                        ],
                        notEnough: [
                            'Soal pembilang dan penyebut belum dijawab.',
                        ],
                    },
                },
                {
                    code: 'C5',
                    description:
                        'Membandingkan dua pecahan satuan (1/2, 1/3, 1/4) dan memberi alasan.',
                    rubric: {
                        visible: [
                            'Memilih 1/3 roti dan alasannya menyebut bahwa roti itu dibagi menjadi lebih sedikit bagian.',
                            'Di tantangan, memilih Ani karena roti yang dibagi 2 potongnya lebih besar daripada yang dibagi 3.',
                        ],
                        developing: [
                            'Memilih jawaban yang tepat, tetapi alasannya belum menjelaskan banyak bagian.',
                            'Mengira 1/4 lebih besar karena angka 4 lebih besar dari 3.',
                        ],
                        notEnough: [
                            'Soal membandingkan belum dijawab, atau alasannya kosong.',
                        ],
                    },
                },
            ],
            sessions: [
                { ...demoModule.session, blocks: demoModule.blocks },
                {
                    title: 'Pembilang dan penyebut',
                    summary:
                        'Kancil menulis pecahan di papan. Apa arti angka di atas dan di bawah garis?',
                    blocks: [
                        {
                            kind: 'hook',
                            content: {
                                prompt: 'Kancil menulis 1/4 di papan tulis. Menurutmu, angka 4 itu menunjukkan apa?',
                                illustration: 'loaf-quarter-marked',
                                options: [
                                    { id: 'a', label: 'Banyak roti' },
                                    {
                                        id: 'b',
                                        label: 'Banyak potongan yang sama besar',
                                    },
                                    { id: 'c', label: 'Banyak teman Kancil' },
                                ],
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'story',
                            content: {
                                text: 'Pecahan ditulis dengan dua angka yang dipisah garis. Angka di atas disebut pembilang, angka di bawah disebut penyebut.',
                                fraction: {
                                    numerator: 1,
                                    denominator: 4,
                                    numeratorNote:
                                        'pembilang: bagian yang diambil',
                                    denominatorNote:
                                        'penyebut: semua bagian yang sama besar',
                                },
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'story',
                            content: {
                                text: 'Roti ini dipotong menjadi 4 bagian sama besar, jadi penyebutnya 4. Kancil mengambil satu bagian, jadi pembilangnya 1.',
                                illustration: 'loaf-quarter-marked',
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'check',
                            content: {
                                prompt: 'Roti bundar ini dipotong menjadi 3 bagian sama besar, dan Kancil mengambil 1/3 roti. Berapa penyebutnya?',
                                illustration: 'round-thirds',
                                options: [
                                    { id: 'a', label: '1' },
                                    { id: 'b', label: '3' },
                                    { id: 'c', label: '4' },
                                ],
                                answer: 'b',
                                praise: 'Tepat! Penyebutnya 3, karena rotinya dibagi menjadi 3 bagian sama besar.',
                                hints: [
                                    {
                                        text: 'Penyebut adalah angka di bawah garis pecahan.',
                                    },
                                    {
                                        text: 'Hitung semua potongan roti bundar ini. Ada berapa potong?',
                                        illustration: 'round-thirds',
                                    },
                                    {
                                        text: 'Pada 1/3, angka 1 ada di atas garis. Angka mana yang ada di bawah garis?',
                                    },
                                ],
                                example: {
                                    text: 'Roti ini dipotong menjadi 2 bagian sama besar. Pada 1/2, penyebutnya 2.',
                                    illustration: 'loaf-halves',
                                },
                                reveal: 'Jawabannya 3, karena penyebut menunjukkan banyak bagian yang sama besar.',
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'story',
                            content: {
                                text: 'Pembilang menunjukkan berapa bagian yang diambil. Kalau Kancil mengambil 1 dari 2 bagian roti, ia mendapat 1/2 roti.',
                                illustration: 'loaf-halves',
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'check',
                            content: {
                                prompt: 'Kertas ini dilipat menjadi 4 bagian sama besar, dan satu bagian diwarnai. Pecahan mana yang menunjukkan bagian berwarna?',
                                illustration: 'paper-quarters',
                                options: [
                                    { id: 'a', label: '1/4' },
                                    { id: 'b', label: '4/1' },
                                    { id: 'c', label: '1/3' },
                                ],
                                answer: 'a',
                                reason: {
                                    prompt: 'Bagaimana kamu tahu?',
                                    starters: [
                                        'Pembilangnya ...',
                                        'Penyebutnya ...',
                                    ],
                                },
                                praise: 'Tepat! Satu bagian berwarna dari 4 bagian sama besar ditulis 1/4.',
                                hints: [
                                    {
                                        text: 'Ada berapa bagian sama besar pada kertas ini? Itulah penyebutnya.',
                                    },
                                    {
                                        text: 'Ada berapa bagian yang diwarnai? Itulah pembilangnya.',
                                    },
                                    {
                                        text: 'Pembilang ditulis di atas garis, penyebut di bawah garis.',
                                    },
                                ],
                                example: {
                                    text: 'Roti ini dipotong menjadi 4 bagian sama besar dan satu bagian diberi warna. Bagian berwarna itu 1/4 roti.',
                                    illustration: 'loaf-quarter-marked',
                                },
                                reveal: 'Jawabannya 1/4, karena 1 bagian diwarnai dari 4 bagian yang sama besar.',
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'challenge',
                            content: {
                                prompt: 'Budi memotong roti menjadi 4 bagian sama besar, lalu memakan 1 bagian. Ia menulis 4/1 di bukunya.',
                                question:
                                    'Apakah tulisan Budi sudah benar? Jelaskan alasanmu.',
                                illustration: 'loaf-quarter-marked',
                                options: [
                                    { id: 'a', label: 'Sudah benar' },
                                    {
                                        id: 'b',
                                        label: 'Belum, seharusnya 1/4',
                                    },
                                ],
                                answer: 'b',
                                reasonStarter:
                                    'Menurutku ... karena pembilangnya ... dan penyebutnya ...',
                            },
                            competencies: ['C4'],
                        },
                        {
                            kind: 'reflection',
                            content: {
                                topics: [
                                    'Arti pembilang',
                                    'Arti penyebut',
                                    'Menulis pecahan',
                                ],
                                takeaways: [
                                    'Penyebut menunjukkan banyak bagian yang sama besar.',
                                    'Pembilang menunjukkan banyak bagian yang diambil.',
                                ],
                            },
                            competencies: ['C4'],
                        },
                    ],
                },
                {
                    title: 'Potongan mana yang lebih besar?',
                    summary:
                        'Kancil membagi roti untuk 2, 3, atau 4 teman. Kapan potongannya paling besar?',
                    blocks: [
                        {
                            kind: 'hook',
                            content: {
                                prompt: 'Kancil punya dua roti yang sama besar. Potongan roti mana yang lebih besar?',
                                options: [
                                    {
                                        id: 'a',
                                        label: 'Roti yang dibagi 2',
                                        illustration: 'loaf-halves',
                                    },
                                    {
                                        id: 'b',
                                        label: 'Roti yang dibagi 4',
                                        illustration: 'loaf-quarters',
                                    },
                                ],
                            },
                            competencies: ['C5'],
                        },
                        {
                            kind: 'story',
                            content: {
                                text: 'Kancil memotong satu roti menjadi 2 bagian sama besar. Setiap bagian adalah 1/2 roti.',
                                illustration: 'loaf-halves',
                            },
                            competencies: ['C5'],
                        },
                        {
                            kind: 'story',
                            content: {
                                text: 'Roti lain yang sama besar ia potong menjadi 4 bagian sama besar. Setiap bagian adalah 1/4 roti, lebih kecil daripada 1/2 roti.',
                                illustration: 'loaf-quarters',
                            },
                            competencies: ['C5'],
                        },
                        {
                            kind: 'story',
                            content: {
                                text: 'Semakin banyak bagian yang sama besar, semakin kecil setiap potongnya. Jadi 1/2 roti lebih besar daripada 1/4 roti.',
                            },
                            competencies: ['C5'],
                        },
                        {
                            kind: 'check',
                            content: {
                                prompt: 'Dua roti bundar sama besar: roti A dibagi 3 dan roti B dibagi 4. Potongan mana yang lebih besar?',
                                options: [
                                    {
                                        id: 'a',
                                        label: '1/3 roti',
                                        illustration: 'round-thirds',
                                    },
                                    {
                                        id: 'b',
                                        label: '1/4 roti',
                                        illustration: 'round-quarters',
                                    },
                                    { id: 'c', label: 'Sama besar' },
                                ],
                                answer: 'a',
                                reason: {
                                    prompt: 'Kenapa?',
                                    starters: [
                                        'Karena ...',
                                        'Rotinya dibagi ...',
                                    ],
                                },
                                praise: 'Tepat! Roti yang dibagi 3 potongnya lebih besar daripada roti yang dibagi 4.',
                                hints: [
                                    {
                                        text: 'Bandingkan banyak potongan kedua roti. Roti mana yang dibagi menjadi lebih sedikit bagian?',
                                    },
                                    {
                                        text: 'Semakin sedikit bagiannya, semakin besar setiap potongnya.',
                                        illustration: 'round-thirds',
                                    },
                                    {
                                        text: '1/3 artinya roti dibagi 3, sedangkan 1/4 artinya roti dibagi 4. Mana yang potongnya lebih besar?',
                                    },
                                ],
                                example: {
                                    text: 'Roti yang dibagi 2 potongnya lebih besar daripada roti yang dibagi 4. Jadi 1/2 lebih besar daripada 1/4.',
                                    illustration: 'loaf-halves',
                                },
                                reveal: 'Jawabannya 1/3 roti, karena roti yang dibagi 3 punya potongan lebih besar daripada roti yang dibagi 4.',
                            },
                            competencies: ['C5'],
                        },
                        {
                            kind: 'challenge',
                            content: {
                                prompt: 'Ani mendapat 1/2 roti dan Dodi mendapat 1/3 roti. Kedua roti itu sama besar.',
                                question:
                                    'Siapa yang mendapat roti lebih banyak? Jelaskan alasanmu.',
                                illustration: 'loaf-pair',
                                options: [
                                    { id: 'a', label: 'Ani' },
                                    { id: 'b', label: 'Dodi' },
                                    { id: 'c', label: 'Sama banyak' },
                                ],
                                answer: 'a',
                                reasonStarter:
                                    'Menurutku ... karena rotinya dibagi ...',
                            },
                            competencies: ['C5'],
                        },
                        {
                            kind: 'reflection',
                            content: {
                                topics: [
                                    'Membandingkan 1/2 dan 1/4',
                                    'Membandingkan 1/3 dan 1/4',
                                    'Banyak bagian dan besar potongan',
                                ],
                                takeaways: [
                                    'Semakin banyak bagian yang sama besar, semakin kecil setiap potongnya.',
                                    '1/2 lebih besar daripada 1/3, dan 1/3 lebih besar daripada 1/4.',
                                ],
                            },
                            competencies: ['C5'],
                        },
                    ],
                },
            ],
        },
        { title: 'Pecahan senilai', competencies: [], sessions: [] },
    ],
};
