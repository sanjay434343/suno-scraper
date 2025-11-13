const https = require('https');

class SunoScraper {
  constructor() {
    this.apiUrl = 'studio-api.prod.suno.com';
    this.endpoint = '/api/discover/';
  }

  generateDeviceId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  fetchData(filters = {}) {
    return new Promise((resolve, reject) => {
      const browserToken = JSON.stringify({
        token: `eyJ0aW1lc3RhbXAiOiR7dGltZXN0YW1wfX0=`
      });

      const postData = JSON.stringify({
        page: filters.page || 0,
        page_size: filters.pageSize || 20,
        section_id: filters.sectionId || "discover_playlist",
        selected_option: filters.language || "Global",
        secondary_selected_option: filters.timeRange || "Now"
      });

      const options = {
        hostname: this.apiUrl,
        path: this.endpoint,
        method: 'POST',
        headers: {
          'accept': '*/*',
          'authorization': 'Bearer null',
          'browser-token': browserToken,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(postData),
          'device-id': this.generateDeviceId(),
          'origin': 'https://suno.com',
          'referer': 'https://suno.com/',
          'user-agent': 'Mozilla/5.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async getSongs(filters = {}) {
    const data = await this.fetchData(filters);

    if (!data.sections || data.sections.length === 0) {
      return {
        success: false,
        message: "No sections found",
        songs: []
      };
    }

    const section = data.sections[0];

    return {
      success: true,
      section: {
        title: section.title,
        id: section.id,
        language: section.selected_option,
        timeRange: section.secondary_selected_option
      },
      total: section.items.length,
      songs: section.items
    };
  }
}

// Vercel API handler
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const scraper = new SunoScraper();

    const {
      page = '0',
      pageSize = '20',
      sectionId = 'discover_playlist',
      language = 'Global',
      timeRange = 'Now'
    } = req.query;

    const apiFilters = {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      sectionId,
      language,
      timeRange
    };

    const result = await scraper.getSongs(apiFilters);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
