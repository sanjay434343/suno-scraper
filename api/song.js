import https from "https";
import crypto from "crypto";

function randomId() {
  return crypto.randomUUID();
}

function browserToken() {
  return JSON.stringify({
    token: Buffer.from(`{"timestamp":${Date.now()}}`).toString("base64")
  });
}

async function sunoPlayCount(songId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ spec: {} });

    const options = {
      hostname: "studio-api.prod.suno.com",
      path: `/api/gen/${songId}/increment_play_count/v2`,
      method: "POST",
      headers: {
        "accept": "*/*",
        "authorization": "Bearer null",
        "browser-token": browserToken(),
        "device-id": randomId(),
        "x-user-id": "anon-" + randomId(),
        "origin": "https://suno.com",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });

    req.on("error", err => {
      resolve({ status: 500, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const songId = req.query.id;
    if (!songId) {
      return res.status(400).json({ success: false, error: "Missing id" });
    }

    const result = await sunoPlayCount(songId);

    return res.status(200).json({
      success: true,
      result
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: err.message
    });
  }
}
