const https = require("https");

function generateDeviceId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function incrementPlayCount(songId) {
  return new Promise((resolve, reject) => {

    const body = JSON.stringify({ spec: {} }); // 🔥 REQUIRED BODY

    const options = {
      hostname: "studio-api.prod.suno.com",
      path: `/api/gen/${songId}/increment_play_count/v2`,
      method: "POST",
      headers: {
        "accept": "*/*",
        "authorization": "Bearer null",
        "browser-token": JSON.stringify({
          token: "eyJ0aW1lc3RhbXAiOiR7dGltZXN0YW1wfX0="
        }),
        "device-id": generateDeviceId(),
        "x-user-id": "anonymous", // 🔥 REQUIRED HEADER
        "origin": "https://suno.com",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const songId = req.query.id;

  try {
    const result = await incrementPlayCount(songId);
    res.status(200).json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
