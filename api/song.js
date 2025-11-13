// api/songs.js
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

  fetchData(filters = {}) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
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
          'accept-language': 'en-US,en;q=0.9',
          'authorization': 'Bearer null',
          'browser-token': browserToken,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(postData),
          'device-id': this.generateDeviceId(),
          'origin': 'https://suno.com',
          'referer': 'https://suno.com/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error('Failed to parse JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  filterSongs(songs, criteria = {}) {
    return songs.filter(song => {
      if (criteria.minPlayCount && song.play_count < criteria.minPlayCount) {
        return false;
      }

      if (criteria.minUpvotes && song.upvote_count < criteria.minUpvotes) {
        return false;
      }

      if (criteria.maxUpvotes && song.upvote_count > criteria.maxUpvotes) {
        return false;
      }

      if (criteria.explicit !== undefined && song.explicit !== criteria.explicit) {
        return false;
      }

      if (criteria.modelVersion && song.major_model_version !== criteria.modelVersion) {
        return false;
      }

      if (criteria.searchTags && Array.isArray(criteria.searchTags)) {
        const tags = (song.metadata?.tags || '') + ' ' + (song.display_tags || '');
        const hasTag = criteria.searchTags.some(tag => 
          tags.toLowerCase().includes(tag.toLowerCase())
        );
        if (!hasTag) return false;
      }

      if (criteria.minDuration && song.metadata?.duration < criteria.minDuration) {
        return false;
      }

      if (criteria.maxDuration && song.metadata?.duration > criteria.maxDuration) {
        return false;
      }

      if (criteria.artist && !song.display_name.toLowerCase().includes(criteria.artist.toLowerCase())) {
        return false;
      }

      if (criteria.searchTitle && !song.title.toLowerCase().includes(criteria.searchTitle.toLowerCase())) {
        return false;
      }

      return true;
    });
  }

  formatSongs(songs) {
    return songs.map(song => ({
      id: song.id,
      title: song.title,
      artist: {
        name: song.display_name,
        handle: song.handle,
        avatar: song.avatar_image_url
      },
      stats: {
        plays: song.play_count,
        upvotes: song.upvote_count,
        comments: song.comment_count
      },
      media: {
        audio: song.audio_url,
        video: song.video_url,
        image: song.image_url,
        imageLarge: song.image_large_url
      },
      metadata: {
        model: song.major_model_version,
        modelName: song.model_name,
        duration: song.metadata?.duration,
        tags: song.metadata?.tags,
        displayTags: song.display_tags,
        explicit: song.explicit,
        prompt: song.metadata?.prompt
      },
      caption: song.caption,
      createdAt: song.created_at,
      isPublic: song.is_public
    }));
  }

  async getSongs(filters = {}, songFilters = {}) {
    const data = await this.fetchData(filters);
    
    if (data.sections && data.sections.length > 0) {
      const section = data.sections[0];
      let songs = section.items || [];
      
      if (Object.keys(songFilters).length > 0) {
        songs = this.filterSongs(songs, songFilters);
      }
      
      return {
        success: true,
        section: {
          title: section.title,
          id: section.id,
          language: section.selected_option,
          timeRange: section.secondary_selected_option,
          availableLanguages: section.options,
          availableTimeRanges: section.secondary_options
        },
        total: songs.length,
        songs: this.formatSongs(songs)
      };
    }
    
    return {
      success: false,
      message: 'No sections found in response',
      songs: []
    };
  }
}

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const scraper = new SunoScraper();
    
    // Parse query parameters
    const {
      language = 'Global',
      timeRange = 'Now',
      page = '0',
      pageSize = '20',
      minPlayCount,
      minUpvotes,
      maxUpvotes,
      explicit,
      modelVersion,
      searchTags,
      minDuration,
      maxDuration,
      artist,
      searchTitle
    } = req.query;

    // API filters
    const apiFilters = {
      language,
      timeRange,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };

    // Song filters
    const songFilters = {};
    
    if (minPlayCount) songFilters.minPlayCount = parseInt(minPlayCount);
    if (minUpvotes) songFilters.minUpvotes = parseInt(minUpvotes);
    if (maxUpvotes) songFilters.maxUpvotes = parseInt(maxUpvotes);
    if (explicit !== undefined) songFilters.explicit = explicit === 'true';
    if (modelVersion) songFilters.modelVersion = modelVersion;
    if (searchTags) songFilters.searchTags = searchTags.split(',');
    if (minDuration) songFilters.minDuration = parseInt(minDuration);
    if (maxDuration) songFilters.maxDuration = parseInt(maxDuration);
    if (artist) songFilters.artist = artist;
    if (searchTitle) songFilters.searchTitle = searchTitle;

    const result = await scraper.getSongs(apiFilters, songFilters);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch songs from Suno API'
    });
  }
};
