const https = require("https");
const crypto = require("crypto");

function randomId() {
  return crypto.randomUUID();
}

function incrementPlayCount(songId) {
  return new Promise((resolve, reject) => {

    const body = JSON.stringify({ spec: {} });

    const browserToken = JSON.stringify({
      token: Buffer.from(`{"timestamp":${Date.now()}}`).toString("base64")
    });

    const options = {
      hostname: "studio-api.prod.suno.com",
      path: `/api/gen/${songId}/increment_play_count/v2`,
      method: "POST",
      headers: {
        "accept": "*/*",
        "authorization": "Bearer null",
        "browser-token": browserToken,
        "device-id": randomId(),           // 🔥 NEW DEVICE FOR EACH REQUEST
        "x-user-id": "anon-" + randomId(), // 🔥 UNIQUE USER FOR EACH REQUEST
        "origin": "https://suno.com",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
