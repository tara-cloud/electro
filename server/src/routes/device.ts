import { FastifyInstance } from 'fastify';
import { db } from '../db';

interface ComponentPin {
    pin: string;
    label: string;
    direction: string;
}

interface ComponentInfo {
    name: string;
    type: string;
    protocol?: string;
    address?: string;
    pins: ComponentPin[];
}

export async function deviceRoutes(app: FastifyInstance) {
    // POST /device/register
    app.post<{ Body: {
        deviceId: string;
        deviceName: string;
        deviceType: string;
        firmwareVersion: string;
        ip?: string;
        components?: ComponentInfo[];
    } }>('/register', async (req, reply) => {
        const { deviceId, deviceName, deviceType, firmwareVersion, ip, components } = req.body;

        const device = await db.device.upsert({
            where:  { deviceId },
            update: { deviceName, deviceType, firmwareVersion, lastSeen: new Date(), ...(ip ? { ipAddress: ip } : {}) },
            create: { deviceId, deviceName, deviceType, firmwareVersion, ...(ip ? { ipAddress: ip } : {}) },
        });

        if (components && components.length > 0) {
            for (const c of components) {
                const comp = await db.deviceComponent.upsert({
                    where:  { deviceId_name: { deviceId, name: c.name } },
                    update: { type: c.type, protocol: c.protocol ?? null, address: c.address ?? null },
                    create: { deviceId, name: c.name, type: c.type, protocol: c.protocol ?? null, address: c.address ?? null },
                });

                await Promise.all(c.pins.map(p =>
                    db.devicePin.upsert({
                        where:  { deviceId_pin: { deviceId, pin: p.pin } },
                        update: { componentId: comp.id, label: p.label, direction: p.direction },
                        create: { componentId: comp.id, deviceId, pin: p.pin, label: p.label, direction: p.direction },
                    })
                ));
            }
        }

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
