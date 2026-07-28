#include <WiFi.h>
#include <WiFiUdp.h>

// --- Wi-Fi credentials ---
const char* ssid = "Samyuktha's Galaxy A34 5G";
const char* password = "12345678";

// --- Receiving PC IP & port ---
const char* hostIP = "192.168.70.238";
const int udpPort = 4210;

WiFiUDP udp;

// --- Potentiometer input pins ---
int potPin_knee   = 34; // Knee
int potPin_ankle  = 35; // Ankle dorsiflexion/plantarflexion
int potPin_inv    = 32; // Ankle inversion/eversion

// --- Neutral ADC positions ---
int neutral_ankle = 2048;
int neutral_inv   = 2048;

// --- EMA filter parameters ---
float alpha = 0.1;  // smoothing factor
float knee_filtered = 0;
float ankle_filtered = 0;
float inv_filtered = 0;

// --- Timing ---
const unsigned long sampleIntervalMicros = 1000; // 1 kHz
unsigned long lastSampleMicros = 0;

const unsigned long udpIntervalMillis = 5; // 200 Hz
unsigned long lastUdpMillis = 0;

void setup() {
  Serial.begin(115200);

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected to WiFi!");
  Serial.print("ESP32 Local IP: ");
  Serial.println(WiFi.localIP());

  udp.begin(udpPort); // Start UDP
}

void loop() {
  unsigned long nowMicros = micros();
  unsigned long nowMillis = millis();

  // --- 1 kHz sampling ---
  if (nowMicros - lastSampleMicros >= sampleIntervalMicros) {
    lastSampleMicros += sampleIntervalMicros;

    int raw_knee  = analogRead(potPin_knee);
    int raw_ankle = analogRead(potPin_ankle);
    int raw_inv   = analogRead(potPin_inv);

    // --- EMA filter ---
    knee_filtered  = alpha * raw_knee  + (1 - alpha) * knee_filtered;
    ankle_filtered = alpha * raw_ankle + (1 - alpha) * ankle_filtered;
    inv_filtered   = alpha * raw_inv   + (1 - alpha) * inv_filtered;
  }

  // --- Send UDP at 200 Hz ---
  if (nowMillis - lastUdpMillis >= udpIntervalMillis) {
    lastUdpMillis = nowMillis;

    // Convert filtered values to angles
    float knee_angle  = (knee_filtered / 4095.0) * 270.0;
    float ankle_angle = (ankle_filtered - neutral_ankle) * (135.0 / 2047.0);
    float inv_angle   = (inv_filtered - neutral_inv) * (135.0 / 2047.0);

    // Format message safely
    char msg[128];
    snprintf(msg, sizeof(msg),
             "R_raw:%d,R_filt:%.2f,L_raw:%d,L_filt:%.2f,I_raw:%d,I_filt:%.2f",
             analogRead(potPin_knee), knee_angle,
             analogRead(potPin_ankle), ankle_angle,
             analogRead(potPin_inv), inv_angle);

    // Send UDP packet
    udp.beginPacket(hostIP, udpPort);
    udp.write((uint8_t*)msg, strlen(msg));
    udp.endPacket();

    // Optional: print to Serial
    Serial.println(msg);
  }
}

