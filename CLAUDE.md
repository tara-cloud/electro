# Electro — Tara ESP32 Device Framework

## Overview

IoT firmware + device management server for the Tara robot ESP32 device.

## Repository Structure

```text
electro/
├── firmware/               # PlatformIO ESP32 firmware (shared core + robot logic)
│   ├── platformio.ini      # robot env
│   ├── src/
│   │   └── main.cpp        # setup() / loop()
│   ├── lib/
│   │   └── TaraCore/       # WiFi, registration, config manager
│   └── devices/
│       └── robot/          # Tara robot hardware + logic
└── server/                 # Fastify + Prisma device management API
    ├── src/
    │   ├── index.ts
    │   ├── db.ts
    │   └── routes/
    │       ├── device.ts   # register, heartbeat
    │       ├── config.ts   # version check, download, push
    │       └── sensor.ts   # sensor readings
    └── prisma/
        └── schema.prisma
```

## Flashing the Robot

```bash
cd firmware
pio run -e robot -t upload
```

## Adding a New Device Type

1. Add a new `[env:my-device]` block in `platformio.ini`
2. Create `devices/my-device/device.cpp` implementing:
   - `void setupDeviceHardware()`
   - `void loadDeviceConfig()`
   - `void runDeviceLogic()`
3. Register the new `DEVICE_TYPE` string in the server

## Server

### Running Locally

```bash
cd server
npm install
npm run dev
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/device/register` | Register / update device |
| POST | `/device/heartbeat` | Update last-seen |
| GET | `/device/config/version/:deviceId` | Latest config version |
| GET | `/device/config/:deviceId` | Download config JSON |
| PUT | `/device/config/:deviceId` | Push new config version |
| POST | `/device/sensor/:deviceId` | Submit sensor reading |
| GET | `/device/sensor/:deviceId` | Query readings |
| GET | `/health` | Health check |

## WiFi Setup

On first boot (or failed WiFi), the device starts a hotspot named after its MAC address.
Connect and hit the captive portal to configure SSID, password, and server URL.
Credentials are stored in NVS under the `tara-wifi` namespace.

## Config Flow

1. Device polls `/device/config/version/{id}` every 5 minutes
2. If version changed → download full config from `/device/config/{id}`
3. `loadDeviceConfig()` parses new JSON and updates live behaviour

## Deployment

```bash
# Build and push server image (ARM64)
docker buildx build --platform linux/arm64 \
  -t pmananthu/electro-server:VERSION --push server/

# On Pi
docker compose -f /DATA/AppData/electro/docker-compose.yml up -d
```

## Environment Variables (server)

```text
DATABASE_URL=postgresql://electro_user:<DB_PASSWORD>@postgres:5432/electro
PORT=4000
```
