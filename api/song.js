const https = require('https');

class SunoScraper {
  constructor() {
    this.apiUrl = 'studio-api.prod.suno.com';
    this.endpoint = '/api/discover/';
  }

  generateDeviceId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  fetchData(page = 0, pageSize = 20) {
    return new Promise((resolve, reject) => {

      const body = JSON.stringify({
        page,
        page_size: pageSize,
        section_id: "discover_playlist",
        selected_option: "Global",
        secondary_selected_option: "Now"
      });

      const options = {
        hostname: this.apiUrl,
        path: this.endpoint,
        method: 'POST',
        headers: {
          "accept": "*/*",
          "authorization": "Bearer null",
          "browser-token": JSON.stringify({ token: "eyJ0aW1lc3RhbXAiOiR7dGltZXN0YW1wfX0=" }),
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "device-id": this.generateDeviceId(),
          "x-user-id": "anonymous",                 // 🔥 NEW REQUIRED HEADER
          "origin": "https://suno.com",
          "referer": "https://suno.com/",
          "user-agent": "Mozilla/5.0"
        }
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  async getSongs(page = 0, pageSize = 20) {
    const data = await this.fetchData(page, pageSize);

    const section = data.sections?.[0];
    if (!section) {
      return { success: false, songs: [] };
    }

    return {
      success: true,
      section: { id: section.id, title: section.title },
      total: section.items.length,
      songs: section.items,
    };
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const page = parseInt(req.query.page || "0");
  const pageSize = parseInt(req.query.pageSize || "20");

  try {
    const scraper = new SunoScraper();
    const result = await scraper.getSongs(page, pageSize);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
