#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ─── Robot states ─────────────────────────────────────────────────────────────
enum RobotState {
    STATE_BOOTING,
    STATE_CONNECTING,
    STATE_REGISTERING,
    STATE_CONFIGURING,
    STATE_IDLE,
    STATE_LISTENING,
    STATE_THINKING,
    STATE_SPEAKING,
    STATE_SLEEPING,
    STATE_ERROR,
};

// ─── Timing ──────────────────────────────────────────────────────────────────
static const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 s
static const unsigned long SENSOR_INTERVAL    = 45000; // 45 s

// ─── NVS namespaces ───────────────────────────────────────────────────────────
static const char* PREF_WIFI   = "tara-wifi";
static const char* PREF_CONFIG = "tara-device";
static const char* AP_PASSWORD = "12345678";

// ─── Globals (defined in main.cpp) ───────────────────────────────────────────
extern String     robotId;
extern String     wifiSSID;
extern String     wifiPassword;
extern String     serverUrl;
extern String     mqttHost;
extern uint16_t   mqttPort;
extern RobotState currentState;
extern WiFiClient wifiClient;
extern PubSubClient mqttClient;

// ─── WiFi / Hotspot ──────────────────────────────────────────────────────────
void loadWiFiConfig();
void connectToWiFi();
void startSetupHotspot();

// ─── Registration (HTTP) ─────────────────────────────────────────────────────
void registerRobot();

// ─── MQTT ────────────────────────────────────────────────────────────────────
void connectMQTT();
void loopMQTT();
void mqttCallback(const char* topic, byte* payload, unsigned int length);
void publishHeartbeat();
void publishSensor();
String robotTopic(const String& suffix);

// ─── Config ───────────────────────────────────────────────────────────────────
void loadLocalConfig();
void applyConfig(const String& json);

// ─── Boot log (device.cpp) ────────────────────────────────────────────────────
// Prints a line to the OLED boot log. Logo stays at top, lines scroll up.
void tlog(const String& msg);

// ─── Device logic (robot/device.cpp) ─────────────────────────────────────────
void setupDeviceHardware();
void handleDisplay(const String& json);
void handleEmotion(const String& json);
void handleSpeech(const String& json);
void handleOTA(const String& json);
void renderIdleFace();
void setState(RobotState s);
