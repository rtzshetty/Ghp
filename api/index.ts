import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const TMDB_API_KEY = process.env.TMDB_API_KEY || "ed9311c3613b06f414be99abaec5dd86";

const searchTmdb = async (query: string) => {
  try {
    const { data } = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
      params: { api_key: TMDB_API_KEY, query },
      timeout: 5000
    });
    return (data.results || [])
      .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
      .map((item: any) => ({
        title: item.name || item.title || 'Untitled',
        link: `tmdb://${item.media_type}/${item.id}`,
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        type: item.media_type === 'movie' ? 'movie' : 'series',
        source: 'TMDB'
      }));
  } catch {
    return [];
  }
};

// Helper to get YouTube trailer embed from TMDB
const getYoutubeTrailer = async (mediaType: string, id: string) => {
  try {
    const typePath = mediaType === 'movie' ? 'movie' : 'tv';
    const { data } = await axios.get(`https://api.themoviedb.org/3/${typePath}/${id}/videos`, {
      params: { api_key: TMDB_API_KEY },
      timeout: 4000
    });
    const trailer = (data.results || []).find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
    if (trailer && trailer.key) {
      return `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`;
    }
  } catch {}
  // Default fallback video (Big Buck Bunny trailer or similar reliable video)
  return 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1';
};

app.get('/api/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });
  const results = await searchTmdb(query);
  res.json({ results });
});

app.get('/api/episodes', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    let mediaType = 'tv';
    let id = '550';

    if (typeof url === 'string' && url.startsWith('tmdb://')) {
      const parts = url.replace('tmdb://', '').split('/');
      mediaType = parts[0];
      id = parts[1];
    } else {
      const cleanTitle = (url as string).split('/').pop()?.replace(/-/g, ' ') || 'anime';
      const searchRes = await searchTmdb(cleanTitle);
      if (searchRes[0]) {
        const parts = searchRes[0].link.replace('tmdb://', '').split('/');
        mediaType = parts[0];
        id = parts[1];
      }
    }

    if (mediaType === 'movie') {
      res.json({
        seasons: [],
        episodes: [{ epNum: '1', title: 'Full Movie', link: `tmdb://movie/${id}`, image: null }]
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/streams', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    let type = 'movie';
    let movieId = '550';
    let tvId = '550';
    let season = '1';
    let episode = '1';

    if (typeof url === 'string' && url.startsWith('tmdb://')) {
      const parts = url.replace('tmdb://', '').split('/');
      type = parts[0];
      if (type === 'movie') {
        movieId = parts[1];
      } else if (type === 'episode') {
        tvId = parts[1];
        season = parts[2];
        episode = parts[3];
        type = 'tv';
      }
    }

    const targetId = type === 'movie' ? movieId : tvId;
    const youtubeEmbed = await getYoutubeTrailer(type, targetId);

    if (type === 'movie') {
      res.json({
        title: "Movie Stream",
        streams: [
          { server: "HD Trailer (Official)", link: youtubeEmbed },
          { server: "VidSrc Player", link: `https://vidsrc.xyz/embed/movie?tmdb=${movieId}` },
          { server: "MultiEmbed", link: `https://multiembed.mov/?video_id=${movieId}&tmdb=1` },
          { server: "EmbedSu", link: `https://embed.su/embed/movie/${movieId}` }
        ]
      });
    } else {
      res.json({
        title: `Episode ${episode}`,
        streams: [
          { server: "HD Trailer (Official)", link: youtubeEmbed },
          { server: "VidSrc Player", link: `https://vidsrc.xyz/embed/tv?tmdb=${tvId}&season=${season}&episode=${episode}` },
          { server: "MultiEmbed", link: `https://multiembed.mov/?video_id=${tvId}&tmdb=1&s=${season}&e=${episode}` },
          { server: "EmbedSu", link: `https://embed.su/embed/tv/${tvId}/${season}/${episode}` }
        ]
      });
    }
  } catch (err: any) {
    res.json({
      title: "Stream",
      streams: [
        { server: "HD Stream", link: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1" },
        { server: "VidSrc Player", link: "https://vidsrc.xyz/embed/movie?tmdb=550" }
      ]
    });
  }
});

export default app;
