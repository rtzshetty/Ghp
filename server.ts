import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANIMESALT_BASE = "https://animesalt.cx";
const TOONSTREAM_BASE = "https://toonstream.vip";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "ed9311c3613b06f414be99abaec5dd86";

async function createServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());

  // Global Request Headers Generator
  const getHeaders = (refererUrl: string) => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': refererUrl || 'https://google.com'
  });

  const fixUrl = (url: string) => {
    if (!url) return url;
    let cleanUrl = url.trim();
    if (!cleanUrl.endsWith('/') && !cleanUrl.includes('?')) {
      cleanUrl += '/';
    }
    return cleanUrl;
  };

  const detectType = (link: string, classText: string) => {
    if (link && link.includes('/movies/')) return 'movie';
    if (classText && classText.includes('type-movies')) return 'movie';
    return 'series';
  };

  const searchAnimeSalt = async (query: string) => {
    try {
      const { data } = await axios.get(`${ANIMESALT_BASE}/?s=${encodeURIComponent(query)}`, {
        headers: getHeaders(ANIMESALT_BASE),
        maxRedirects: 5
      });
      const $ = cheerio.load(data);
      const results: any[] = [];
      $('ul.post-lst li').each((index, element) => {
        const classText = $(element).attr('class') || '';
        const title = $(element).find('h2.entry-title').text().trim();
        let link = $(element).find('a.lnk-blk').attr('href');
        let image = $(element).find('img').attr('data-src') || $(element).find('img').attr('src');

        if (image && image.startsWith('//')) image = 'https:' + image;
        if (link) {
          if (!link.startsWith('http')) link = `${ANIMESALT_BASE}${link}`;
          link = fixUrl(link);
        }

        const type = detectType(link || '', classText);

        if (title && link) {
          results.push({ title, link, image, type, source: 'AnimeSalt' });
        }
      });
      return results;
    } catch { return []; }
  };

  const searchToonStream = async (query: string) => {
    try {
      const { data } = await axios.get(`${TOONSTREAM_BASE}/s?q=${encodeURIComponent(query)}`, {
        headers: getHeaders(TOONSTREAM_BASE),
        maxRedirects: 5
      });
      const $ = cheerio.load(data);
      const results: any[] = [];
      $('ul.post-lst li').each((index, element) => {
        const classText = $(element).attr('class') || '';
        const title = $(element).find('h2.entry-title').text().trim();
        let link = $(element).find('a.lnk-blk').attr('href');
        let image = $(element).find('img').attr('data-src') || $(element).find('img').attr('src');

        if (image && image.startsWith('//')) image = 'https:' + image;
        if (link) {
          if (!link.startsWith('http')) {
            link = `${TOONSTREAM_BASE}${link.startsWith('/') ? '' : '/'}${link}`;
          }
          link = fixUrl(link);
        }

        const type = detectType(link || '', classText);

        if (title && link) {
          results.push({ title, link, image, type, source: 'ToonStream' });
        }
      });
      return results;
    } catch { return []; }
  };

  const resolveEmbedUrl = async (embedUrl: string) => {
    try {
      const { data } = await axios.get(embedUrl, {
        headers: getHeaders(TOONSTREAM_BASE),
        timeout: 3000,
        maxRedirects: 5
      });
      const $ = cheerio.load(data);
      const nestedIframe = $('iframe').attr('src') || $('iframe').attr('data-src');
      if (nestedIframe) return nestedIframe;

      let directVideoUrl = null;
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent) {
          const m3u8Match = scriptContent.match(/(https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*)/i);
          const mp4Match = scriptContent.match(/(https?:\/\/[^\s"'`]+\.mp4[^\s"'`]*)/i);
          if (m3u8Match) directVideoUrl = m3u8Match[1].replace(/\\/g, '');
          else if (mp4Match) directVideoUrl = mp4Match[1].replace(/\\/g, '');
        }
      });
      return directVideoUrl || embedUrl;
    } catch { return embedUrl; }
  };

  // API Routes
  app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });
    const [saltResults, toonResults] = await Promise.all([
      searchAnimeSalt(query),
      searchToonStream(query)
    ]);
    res.json({ results: [...saltResults, ...toonResults] });
  });

  app.get('/api/episodes', async (req, res) => {
    const { url, source } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const pageUrl = fixUrl(url as string);
    const base = source === 'AnimeSalt' ? ANIMESALT_BASE : TOONSTREAM_BASE;

    try {
      const { data } = await axios.get(pageUrl, { headers: getHeaders(base), maxRedirects: 5 });
      const $ = cheerio.load(data);
      const episodes: any[] = [];
      const seasons: any[] = [];

      if (source === 'AnimeSalt') {
        $('.season-btn').each((i, el) => {
          seasons.push({ name: $(el).text().trim(), seasonNum: $(el).attr('data-season'), postId: $(el).attr('data-post') });
        });
      } else {
        $('.season-btn').each((i, el) => {
          seasons.push({ name: $(el).text().trim(), seasonNum: $(el).attr('data-season'), ajaxUrl: $(el).attr('data-url') });
        });
      }

      $('#episode_by_temp li').each((i, element) => {
        const epNum = $(element).find('.num-epi').text().trim();
        const title = source === 'AnimeSalt' ? $(element).find('h2.entry-title').text().trim() : $(element).find('h5.entry-title1').text().trim();
        let link = $(element).find('a.lnk-blk').attr('href');
        if (link) {
          if (!link.startsWith('http')) link = `${base}${link.startsWith('/') ? '' : '/'}${link}`;
          link = fixUrl(link);
        }
        let image = $(element).find('img').attr('data-src') || $(element).find('img').attr('src');
        if (image && image.startsWith('//')) image = 'https:' + image;
        if (link) episodes.push({ epNum: epNum || (i + 1).toString(), title, link, image });
      });
      res.json({ seasons, episodes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/streams', async (req, res) => {
    const { url, source } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const epUrl = fixUrl(url as string);
    const base = source === 'AnimeSalt' ? ANIMESALT_BASE : TOONSTREAM_BASE;

    try {
      const { data } = await axios.get(epUrl, { headers: getHeaders(base), maxRedirects: 5 });
      const $ = cheerio.load(data);
      const streamSources: any[] = [];
      const title = $('h1').text().trim() || $('h1.entry-title').text().trim();
      let poster = $('.post-thumbnail img').attr('src') || $('.post-thumbnail img').attr('data-src');
      let backdrop = $('.bghd img.TPostBg').attr('src') || $('.bghd img').attr('src');

      if (source === 'AnimeSalt') {
        $('#aa-options iframe').each((index, element) => {
          const src = $(element).attr('src') || $(element).attr('data-src');
          if (!src) return;
          if (src.includes('?data=')) {
            try {
              const urlObj = new URL(src);
              const base64Data = urlObj.searchParams.get('data');
              if (base64Data) {
                const decodedJson = Buffer.from(base64Data, 'base64').toString('utf-8');
                const parsedStreams = JSON.parse(decodedJson);
                parsedStreams.forEach((stream: any) => {
                  streamSources.push({ server: 'Abyss (Multi-Lang)', language: stream.language, link: stream.link });
                });
              }
            } catch {}
          } else {
            streamSources.push({ server: src.includes('as-cdn') ? 'playX' : 'Server', language: 'Default', link: src });
          }
        });
      } else {
        const serverMap: any = {};
        $('.video-options .aa-tbs-video li').each((i, el) => {
          const optionId = $(el).find('a.btn').attr('href');
          const serverName = $(el).find('.server').text().trim() || `Server ${i + 1}`;
          if (optionId) serverMap[optionId.replace('#', '')] = serverName;
        });
        const rawStreams: any[] = [];
        $('.video-player .video').each((i, el) => {
          const id = $(el).attr('id');
          let src = $(el).find('iframe').attr('src') || $(el).find('iframe').attr('data-src');
          if (!src || src === 'about:blank') return;
          if (src.startsWith('/')) src = `${TOONSTREAM_BASE}${src}`;
          rawStreams.push({ serverName: serverMap[id || ''] || `Server ${i + 1}`, link: src });
        });
        const resolved = await Promise.all(rawStreams.map(async (s) => ({
          server: s.serverName,
          link: s.link.includes('/embed/') ? await resolveEmbedUrl(s.link) : s.link
        })));
        streamSources.push(...resolved);
      }

      res.json({ title, poster, backdrop, streams: streamSources });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tmdb-episode', async (req, res) => {
    const { title, season, episode } = req.query;
    try {
      const searchRes = await axios.get(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title as string)}`);
      const tvShow = searchRes.data.results[0];
      if (!tvShow) return res.status(404).json({ error: "Not found" });
      const epRes = await axios.get(`https://api.themoviedb.org/3/tv/${tvShow.id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`);
      res.json(epRes.data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const template = await vite.transformIndexHtml(url, `<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
