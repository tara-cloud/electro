import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function deviceRoutes(app: FastifyInstance) {
    // POST /device/register
    app.post<{ Body: {
        deviceId: string;
        deviceName: string;
        deviceType: string;
        firmwareVersion: string;
        ip?: string;
    } }>('/register', async (req, reply) => {
        const { deviceId, deviceName, deviceType, firmwareVersion, ip } = req.body;

        const device = await db.device.upsert({
            where:  { deviceId },
            update: { deviceName, deviceType, firmwareVersion, lastSeen: new Date(), ...(ip ? { ipAddress: ip } : {}) },
            create: { deviceId, deviceName, deviceType, firmwareVersion, ...(ip ? { ipAddress: ip } : {}) },
        });

        return reply.code(200).send({ id: device.id, deviceId: device.deviceId });
    });

    // POST /device/heartbeat
    app.post<{ Body: {
        deviceId: string;
        ip?: string;
        firmwareVersion?: string;
        status?: string;
    } }>('/heartbeat', async (req, reply) => {
        const { deviceId, ip, firmwareVersion } = req.body;

        await db.device.update({
            where: { deviceId },
            data: {
                lastSeen: new Date(),
                ...(firmwareVersion ? { firmwareVersion } : {}),
                ...(ip             ? { ipAddress: ip }   : {}),
            },
        });

        return reply.code(200).send({ ok: true });
    });
}
