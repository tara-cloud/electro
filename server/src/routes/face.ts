import { FastifyInstance } from 'fastify';
import { db } from '../db';

// Default faces seeded on first startup — all 8 emotions as draw command JSON
const DEFAULT_FACES = [
    {
        name: 'idle', label: 'Idle',
        cmds: [
            { t: 'disc',  x: 38, y: 26, r: 9 },
            { t: 'disc',  x: 90, y: 26, r: 9 },
            { t: 'hline', x: 52, y: 46, w: 24 },
        ],
    },
    {
        name: 'happy', label: 'Happy',
        cmds: [
            { t: 'disc',  x: 38,  y: 24, r: 9 },
            { t: 'disc',  x: 90,  y: 24, r: 9 },
            { t: 'disc',  x: 26,  y: 38, r: 5 },
            { t: 'disc',  x: 102, y: 38, r: 5 },
            { t: 'hline', x: 50,  y: 46, w: 28 },
            { t: 'pixel', x: 50,  y: 47 },
            { t: 'pixel', x: 77,  y: 47 },
        ],
    },
    {
        name: 'sad', label: 'Sad',
        cmds: [
            { t: 'disc',  x: 38, y: 28, r: 8 },
            { t: 'disc',  x: 90, y: 28, r: 8 },
            { t: 'hline', x: 52, y: 48, w: 24 },
            { t: 'pixel', x: 52, y: 47 },
            { t: 'pixel', x: 75, y: 47 },
        ],
    },
    {
        name: 'thinking', label: 'Thinking',
        cmds: [
            { t: 'disc',  x: 38, y: 22, r: 9 },
            { t: 'disc',  x: 90, y: 18, r: 9 },
            { t: 'disc',  x: 54, y: 50, r: 2 },
            { t: 'disc',  x: 64, y: 50, r: 2 },
            { t: 'disc',  x: 74, y: 50, r: 2 },
        ],
    },
    {
        name: 'sleeping', label: 'Sleeping',
        cmds: [
            { t: 'hline', x: 29, y: 26, w: 18 },
            { t: 'hline', x: 81, y: 26, w: 18 },
            { t: 'text',  x: 96, y: 18, s: 'z',  font: 'small' },
            { t: 'text',  x: 104,y: 12, s: 'z',  font: 'small' },
            { t: 'text',  x: 112,y: 6,  s: 'z',  font: 'small' },
        ],
    },
    {
        name: 'listening', label: 'Listening',
        cmds: [
            { t: 'disc',   x: 38, y: 26, r: 11 },
            { t: 'disc',   x: 90, y: 26, r: 11 },
            { t: 'circle', x: 64, y: 48, r: 6  },
        ],
    },
    {
        name: 'speaking', label: 'Speaking',
        cmds: [
            { t: 'disc', x: 38, y: 26, r: 9  },
            { t: 'disc', x: 90, y: 26, r: 9  },
            { t: 'rbox', x: 50, y: 42, w: 28, h: 12, r: 4 },
        ],
    },
    {
        name: 'error', label: 'Error',
        cmds: [
            ...Array.from({ length: 13 }, (_, i) => i - 6).flatMap(d => [
                { t: 'pixel', x: 38 + d, y: 26 + d },
                { t: 'pixel', x: 38 + d, y: 26 - d },
                { t: 'pixel', x: 90 + d, y: 26 + d },
                { t: 'pixel', x: 90 + d, y: 26 - d },
            ]),
            { t: 'hline', x: 54, y: 46, w: 20 },
        ],
    },
];

export async function seedFaces() {
    const count = await db.face.count();
    if (count > 0) return;
    await db.face.createMany({
        data: DEFAULT_FACES.map(f => ({ name: f.name, label: f.label, cmds: f.cmds })),
        skipDuplicates: true,
    });
    console.log('[Faces] Default faces seeded');
}

// Build the faces map pushed into device config:
// { "idle": "{cmds:[...]}", "happy": "{cmds:[...]}", ... }
export async function buildFacesMap(): Promise<Record<string, string>> {
    const faces = await db.face.findMany();
    const map: Record<string, string> = {};
    for (const f of faces) {
        map[f.name] = JSON.stringify({ cmds: f.cmds });
    }
    return map;
}

export async function faceRoutes(app: FastifyInstance) {
    // GET /faces — list all faces
    app.get('/', async () => db.face.findMany({ orderBy: { name: 'asc' } }));

    // GET /faces/:name — single face
    app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
        const face = await db.face.findUnique({ where: { name: req.params.name } });
        if (!face) return reply.code(404).send({ error: 'Not found' });
        return face;
    });

    // PUT /faces/:name — upsert face definition
    app.put<{
        Params: { name: string };
        Body: { label?: string; cmds: object[] };
    }>('/:name', async (req, reply) => {
        const { name } = req.params;
        const { label = name, cmds } = req.body;

        const face = await db.face.upsert({
            where:  { name },
            create: { name, label, cmds },
            update: { label, cmds },
        });
        return reply.code(200).send(face);
    });

    // DELETE /faces/:name — remove a face
    app.delete<{ Params: { name: string } }>('/:name', async (req, reply) => {
        await db.face.delete({ where: { name: req.params.name } });
        return reply.code(200).send({ ok: true });
    });
}
