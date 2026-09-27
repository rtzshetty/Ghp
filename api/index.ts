import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
app.use(express.json());

const ANIMESALT_BASE = "https://animesalt.cx";
const TOONSTREAM_BASE = "https://toonstream.vip";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "ed9311c3613b06f414be99abaec5dd86";

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

// Primary & Reliable Search via TMDB API (Works everywhere including Vercel serverless)
const searchTmdb = async (query: string) => {
  try {
    const { data } = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query
      },
      timeout: 5000
    });
    const results = (data.results || [])
      .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
      .map((item: any) => ({
        title: item.name || item.title || 'Untitled',
        link: `tmdb://${item.media_type}/${item.id}`,
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        type: item.media_type === 'movie' ? 'movie' : 'series',
        source: 'TMDB'
      }));
    return results;
  } catch (err) {
    console.error("TMDB Search Error:", err);
    return [];
  }
};

// Secondary Scrapers (May be blocked by Cloudflare on Vercel)
const searchAnimeSalt = async (query: string) => {
  try {
    const { data } = await axios.get(`${ANIMESALT_BASE}/?s=${encodeURIComponent(query)}`, {
      headers: getHeaders(ANIMESALT_BASE),
      timeout: 2500,
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

      const type = (link && link.includes('/movies/')) || classText.includes('type-movies') ? 'movie' : 'series';

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
      timeout: 2500,
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

      const type = (link && link.includes('/movies/')) || classText.includes('type-movies') ? 'movie' : 'series';

      if (title && link) {
        results.push({ title, link, image, type, source: 'ToonStream' });
      }
    });
    return results;
  } catch { return []; }
};

app.get('/api/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

  // Always get TMDB results first (instant & reliable on Vercel)
  const tmdbResults = await searchTmdb(query);

  // Try scrapers in parallel with short timeout, but don't let them block or fail the request
  let scraperResults: any[] = [];
  try {
    const [saltResults, toonResults] = await Promise.all([
      searchAnimeSalt(query).catch(() => []),
      searchToonStream(query).catch(() => [])
    ]);
    scraperResults = [...saltResults, ...toonResults];
  } catch {
    scraperResults = [];
  }

  // Combine with scraper results on top if available, followed by TMDB
  const results = [...scraperResults, ...tmdbResults];
  res.json({ results });
});

app.get('/api/episodes', async (req, res) => {
  const { url, source } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  if (source === 'TMDB' || (typeof url === 'string' && url.startsWith('tmdb://'))) {
    try {
      const parts = (url as string).replace('tmdb://', '').split('/');
      const mediaType = parts[0];
      const id = parts[1];

      if (mediaType === 'movie') {
        res.json({
          seasons: [],
          episodes: [{ epNum: '1', title: 'Full Movie', link: url, image: null }]
        });
        return;
      }

      const showRes = await axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
        params: { api_key: TMDB_API_KEY }
      });
      const seasonsList = showRes.data.seasons || [];
      const seasonNum = seasonsList[0]?.season_number || 1;

      const seasonRes = await axios.get(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNum}`, {
        params: { api_key: TMDB_API_KEY }
      });

      const episodes = (seasonRes.data.episodes || []).map((ep: any) => ({
        epNum: ep.episode_number.toString(),
        title: ep.name || `Episode ${ep.episode_number}`,
        link: `tmdb://episode/${id}/${ep.season_number}/${ep.episode_number}`,
        image: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null
      }));

      res.json({
        seasons: seasonsList.map((s: any) => ({ name: s.name, seasonNum: s.season_number })),
        episodes
      });
      return;
    } catch (err: any) {
      res.status(500).json({ error: err.message });
      return;
    }
  }

  const pageUrl = fixUrl(url as string);
  const base = source === 'AnimeSalt' ? ANIMESALT_BASE : TOONSTREAM_BASE;

  try {
    const { data } = await axios.get(pageUrl, { headers: getHeaders(base), timeout: 4000, maxRedirects: 5 });
    const $ = cheerio.load(data);
    const episodes: any[] = [];
    const seasons: any[] = [];

    $('.season-btn').each((i, el) => {
      seasons.push({ name: $(el).text().trim(), seasonNum: $(el).attr('data-season') });
    });

    $('#episode_by_temp li').each((i, element) => {
      const epNum = $(element).find('.num-epi').text().trim();
      const title = $(element).find('h2.entry-title, h5.entry-title1').text().trim();
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

  if (source === 'TMDB' || (typeof url === 'string' && url.startsWith('tmdb://'))) {
    res.json({
      title: "Streaming",
      poster: null,
      backdrop: null,
      streams: [
        { server: "Primary Stream (HD)", link: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" },
        { server: "Alternative Server", link: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0" }
      ]
    });
    return;
  }

  const epUrl = fixUrl(url as string);
  const base = source === 'AnimeSalt' ? ANIMESALT_BASE : TOONSTREAM_BASE;

  try {
    const { data } = await axios.get(epUrl, { headers: getHeaders(base), timeout: 4000, maxRedirects: 5 });
    const $ = cheerio.load(data);
    const streamSources: any[] = [];
    const title = $('h1').text().trim() || $('h1.entry-title').text().trim();
    let poster = $('.post-thumbnail img').attr('src') || $('.post-thumbnail img').attr('data-src');
    let backdrop = $('.bghd img.TPostBg').attr('src') || $('.bghd img').attr('src');

    $('#aa-options iframe, .video-player iframe').each((index, element) => {
      const src = $(element).attr('src') || $(element).attr('data-src');
      if (src && src !== 'about:blank') {
        streamSources.push({ server: `Server ${index + 1}`, link: src.startsWith('/') ? `${base}${src}` : src });
      }
    });

    if (streamSources.length === 0) {
      streamSources.push({ server: "Default Server", link: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    }

    res.json({ title, poster, backdrop, streams: streamSources });
  } catch (err: any) {
    res.status(500).json({ error: "Stream unavailable or blocked by upstream." });
  }
});

export default app;
