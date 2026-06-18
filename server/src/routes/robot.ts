import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { publishToRobot } from '../mqtt';
import { buildFacesMap } from './face';

export async function robotRoutes(app: FastifyInstance) {
    // GET /robot — list all registered robots with latest health
    app.get('/', async () => {
        return db.device.findMany({
            where:   { deviceType: 'robot' },
            orderBy: { lastSeen: 'desc' },
            include: { readings: { take: 1, orderBy: { recordedAt: 'desc' } } },
        });
    });

    // GET /robot/:deviceId — single robot detail
    app.get<{ Params: { deviceId: string } }>(
        '/:deviceId',
        async (req, reply) => {
            const device = await db.device.findUnique({
                where:   { deviceId: req.params.deviceId },
                include: {
                    configs:  { orderBy: { createdAt: 'desc' }, take: 5 },
                    readings: { orderBy: { recordedAt: 'desc' }, take: 20 },
                },
            });
            if (!device) return reply.code(404).send({ error: 'Not found' });
            return device;
        }
    );

    // POST /robot/:deviceId/display — send draw commands or face name
    // If body has "face" name: resolve to cmds from DB and send inline
    // If body has "cmds" array: forward directly
    app.post<{
        Params: { deviceId: string };
        Body:   { face?: string; cmds?: object[] };
    }>('/:deviceId/display', async (req, reply) => {
        const { deviceId } = req.params;
        const { face, cmds } = req.body;

        if (cmds) {
            publishToRobot(deviceId, 'display', { cmds });
            return reply.code(200).send({ ok: true });
        }

        if (face) {
            const faceDoc = await db.face.findUnique({ where: { name: face } });
            if (!faceDoc) return reply.code(404).send({ error: `Face '${face}' not found` });
            publishToRobot(deviceId, 'display', { cmds: faceDoc.cmds });
            return reply.code(200).send({ ok: true });
        }

        return reply.code(400).send({ error: 'Provide either face or cmds' });
    });

    // POST /robot/:deviceId/emotion
    app.post<{
        Params: { deviceId: string };
        Body:   { state: string; energy?: number };
    }>('/:deviceId/emotion', async (req, reply) => {
        publishToRobot(req.params.deviceId, 'emotion', req.body);
        return reply.code(200).send({ ok: true });
    });

    // POST /robot/:deviceId/speech
    app.post<{
        Params: { deviceId: string };
        Body:   { text: string };
    }>('/:deviceId/speech', async (req, reply) => {
        publishToRobot(req.params.deviceId, 'speech', req.body);
        return reply.code(200).send({ ok: true });
    });

    // PUT /robot/:deviceId/config — push config; always injects current faces
    app.put<{
        Params: { deviceId: string };
        Body:   Record<string, unknown>;
    }>('/:deviceId/config', async (req, reply) => {
        const { deviceId } = req.params;
        const faces = await buildFacesMap();

        const last = await db.deviceConfig.findFirst({
            where:   { deviceId },
            orderBy: { createdAt: 'desc' },
        });
        const version = String((parseInt(last?.version ?? '0') + 1));

        const configWithFaces = { ...req.body, faces, version };

        await db.deviceConfig.create({
            data: { deviceId, version, config: configWithFaces },
        });

        publishToRobot(deviceId, 'config', configWithFaces, 1);
        return reply.code(201).send({ version });
    });

    // POST /robot/ota/broadcast?deviceType=robot — push OTA to all devices of a type
    // Called by Pocket when an OTA release is pushed
    app.post<{
        Querystring: { deviceType?: string };
        Body:        { version: string; url: string };
    }>('/ota/broadcast', async (req, reply) => {
        const deviceType = req.query.deviceType ?? 'robot';
        const { version, url } = req.body;

        if (!version || !url) return reply.code(400).send({ error: 'version and url required' });

        // Find all registered devices of this type
        const devices = await db.device.findMany({
            where: { deviceType },
            select: { deviceId: true },
        });

        for (const d of devices) {
            publishToRobot(d.deviceId, 'ota', { version, url }, 1);
        }

        return reply.code(200).send({ pushed: devices.length, version, url });
    });
}
