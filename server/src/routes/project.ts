import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function projectRoutes(app: FastifyInstance) {

    // ── Projects ──────────────────────────────────────────────────────────────

    // GET /projects
    app.get('/', async () => {
        const projects = await db.project.findMany({ orderBy: { createdAt: 'asc' } });
        return Promise.all(projects.map(async p => ({
            ...p,
            deviceCount:  await db.device.count({ where: { projectId: p.id } }),
            serviceCount: await db.service.count({ where: { projectId: p.id } }),
        })));
    });

    // POST /projects
    app.post<{ Body: { name: string; description?: string } }>(
        '/',
        async (req, reply) => {
            const proj = await db.project.create({
                data: { name: req.body.name, description: req.body.description ?? '' },
            });
            return reply.code(201).send(proj);
        }
    );

    // GET /projects/:id
    app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const proj = await db.project.findUnique({
            where:   { id: req.params.id },
            include: {
                devices:  { orderBy: { createdAt: 'asc' } },
                services: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!proj) return reply.code(404).send({ error: 'Not found' });
        return proj;
    });

    // PUT /projects/:id
    app.put<{
        Params: { id: string };
        Body:   { name?: string; description?: string };
    }>('/:id', async (req, reply) => {
        const proj = await db.project.update({
            where: { id: req.params.id },
            data:  { name: req.body.name, description: req.body.description },
        });
        return reply.code(200).send(proj);
    });

    // DELETE /projects/:id
    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
        // Unassign devices before deleting
        await db.device.updateMany({
            where: { projectId: req.params.id },
            data:  { projectId: null },
        });
        await db.project.delete({ where: { id: req.params.id } });
        return reply.code(200).send({ ok: true });
    });

    // ── Devices within a project ──────────────────────────────────────────────

    // GET /projects/:id/devices
    app.get<{ Params: { id: string } }>('/:id/devices', async (req) => {
        return db.device.findMany({ where: { projectId: req.params.id }, orderBy: { createdAt: 'asc' } });
    });

    // POST /projects/:id/devices/:deviceId — assign a device to this project
    app.post<{ Params: { id: string; deviceId: string } }>(
        '/:id/devices/:deviceId',
        async (req, reply) => {
            await db.device.update({
                where: { deviceId: req.params.deviceId },
                data:  { projectId: req.params.id },
            });
            return reply.code(200).send({ ok: true });
        }
    );

    // DELETE /projects/:id/devices/:deviceId — unassign device from project
    app.delete<{ Params: { id: string; deviceId: string } }>(
        '/:id/devices/:deviceId',
        async (req, reply) => {
            await db.device.update({
                where: { deviceId: req.params.deviceId },
                data:  { projectId: null },
            });
            return reply.code(200).send({ ok: true });
        }
    );

    // ── Services (Brain) within a project ────────────────────────────────────

    // GET /projects/:id/services
    app.get<{ Params: { id: string } }>('/:id/services', async (req) => {
        return db.service.findMany({ where: { projectId: req.params.id }, orderBy: { createdAt: 'asc' } });
    });

    // POST /projects/:id/services
    app.post<{
        Params: { id: string };
        Body:   { name: string; description?: string; url?: string };
    }>('/:id/services', async (req, reply) => {
        const svc = await db.service.create({
            data: {
                projectId:   req.params.id,
                name:        req.body.name,
                description: req.body.description ?? '',
                url:         req.body.url ?? '',
            },
        });
        return reply.code(201).send(svc);
    });

    // PUT /projects/:id/services/:sid
    app.put<{
        Params: { id: string; sid: string };
        Body:   { name?: string; description?: string; url?: string; status?: string };
    }>('/:id/services/:sid', async (req, reply) => {
        const svc = await db.service.update({
            where: { id: req.params.sid },
            data:  req.body,
        });
        return reply.code(200).send(svc);
    });

    // DELETE /projects/:id/services/:sid
    app.delete<{ Params: { id: string; sid: string } }>(
        '/:id/services/:sid',
        async (req, reply) => {
            await db.service.delete({ where: { id: req.params.sid } });
            return reply.code(200).send({ ok: true });
        }
    );
}
