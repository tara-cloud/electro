#include "TaraCore.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ─── WiFi ────────────────────────────────────────────────────────────────────

void loadWiFiConfig() {
    Preferences prefs;
    prefs.begin(PREF_WIFI, true);
    wifiSSID     = prefs.getString("ssid",      "");
    wifiPassword = prefs.getString("password",  "");
    serverUrl    = prefs.getString("serverUrl", "");
    mqttHost     = prefs.getString("mqttHost",  "");
    mqttPort     = prefs.getUShort("mqttPort",  1883);
    prefs.end();
}

void connectToWiFi() {
    setState(STATE_CONNECTING);

    if (wifiSSID.length() == 0) {
        startSetupHotspot();
        return;
    }

    tlog("WiFi: connecting...");
    Serial.printf("WiFi connecting to %s", wifiSSID.c_str());
    WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nWiFi failed — hotspot");
        tlog("WiFi: failed");
        startSetupHotspot();
    } else {
        Serial.printf("\nConnected: %s\n", WiFi.localIP().toString().c_str());
        tlog("WiFi: " + WiFi.localIP().toString());
    }
}

void startSetupHotspot() {
    WiFi.softAP(robotId.c_str(), AP_PASSWORD);
    String apIp = WiFi.softAPIP().toString();
    Serial.printf("AP started: %s\n", apIp.c_str());
    tlog("AP mode: " + apIp);
    // TODO: serve captive-portal form → save PREF_WIFI → reboot
    while (true) delay(1000);
}

// ─── Registration ────────────────────────────────────────────────────────────

void registerRobot() {
    setState(STATE_REGISTERING);
    if (WiFi.status() != WL_CONNECTED) return;

    tlog("Registering...");
    HTTPClient http;
    http.begin(serverUrl + "/device/register");
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["deviceId"]        = robotId;
    doc["deviceName"]      = DEVICE_NAME;
    doc["deviceType"]      = DEVICE_TYPE;
    doc["firmwareVersion"] = FW_VERSION;

    String body;
    serializeJson(doc, body);
    int code = http.POST(body);
    http.end();

    Serial.printf("Register: %d\n", code);
    if (code == 200 || code == 201) {
        tlog("Registered: OK");
    } else {
        tlog("Register: fail " + String(code));
    }
}

// ─── MQTT ────────────────────────────────────────────────────────────────────

String robotTopic(const String& suffix) {
    return "tara/robot/" + robotId + "/" + suffix;
}

void connectMQTT() {
    setState(STATE_CONFIGURING);
    mqttClient.setServer(mqttHost.c_str(), mqttPort);
    mqttClient.setCallback(mqttCallback);

    tlog("MQTT: connecting...");
    Serial.printf("MQTT connecting to %s:%d\n", mqttHost.c_str(), mqttPort);

    while (!mqttClient.connected()) {
        if (mqttClient.connect(robotId.c_str())) {
            Serial.println("MQTT connected");
            tlog("MQTT: connected");

            mqttClient.subscribe(robotTopic("config").c_str(),  1);
            mqttClient.subscribe(robotTopic("display").c_str(), 0);
            mqttClient.subscribe(robotTopic("emotion").c_str(), 0);
            mqttClient.subscribe(robotTopic("speech").c_str(),  0);
            mqttClient.subscribe(robotTopic("ota").c_str(),     1);
        } else {
            Serial.printf("MQTT failed (%d), retrying...\n", mqttClient.state());
            tlog("MQTT: retry " + String(mqttClient.state()));
            delay(3000);
        }
    }
}

void loopMQTT() {
    if (!mqttClient.connected()) {
        tlog("MQTT: reconnecting");
        connectMQTT();
    }
    mqttClient.loop();
}

void mqttCallback(const char* topic, byte* payload, unsigned int length) {
    String t   = String(topic);
    String msg = String((char*)payload, length);

    Serial.printf("MQTT [%s]: %s\n", t.c_str(), msg.c_str());

    if      (t.endsWith("/config"))  applyConfig(msg);
    else if (t.endsWith("/display")) handleDisplay(msg);
    else if (t.endsWith("/emotion")) handleEmotion(msg);
    else if (t.endsWith("/speech"))  handleSpeech(msg);
    else if (t.endsWith("/ota"))     handleOTA(msg);
}

void publishHeartbeat() {
    JsonDocument doc;
    doc["status"]   = "ONLINE";
    doc["firmware"] = FW_VERSION;
    doc["uptime"]   = millis() / 1000;

    String msg;
    serializeJson(doc, msg);
    mqttClient.publish(robotTopic("heartbeat").c_str(), msg.c_str(), false);
}

void publishSensor() {
    JsonDocument doc;
    doc["temperature"] = 0;
    doc["battery"]     = 100;

    String msg;
    serializeJson(doc, msg);
    mqttClient.publish(robotTopic("sensor").c_str(), msg.c_str(), false);
}

// ─── Config ───────────────────────────────────────────────────────────────────

void loadLocalConfig() {
    Preferences prefs;
    prefs.begin(PREF_CONFIG, true);
    String json = prefs.getString("configJson", "");
    prefs.end();
    if (json.length() > 0) applyConfig(json);
}

void applyConfig(const String& json) {
    Preferences prefs;
    prefs.begin(PREF_CONFIG, false);
    prefs.putString("configJson", json);
    prefs.end();

    JsonDocument doc;
    if (deserializeJson(doc, json) != DeserializationError::Ok) return;

    Serial.printf("Config applied: v%d\n", (int)doc["version"]);
    extern void applyRobotConfig(const JsonDocument&);
    applyRobotConfig(doc);
}
