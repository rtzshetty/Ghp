import React, { useState, useEffect } from 'react';
import { Search, Play, Info, X, Loader2, Download, Tv, MonitorPlay, Heart, Bookmark, Sparkles, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Result {
  title: string;
  link: string;
  image: string;
  type: 'movie' | 'series';
  source: 'AnimeSalt' | 'ToonStream';
}

interface Episode {
  epNum: string;
  title: string;
  link: string;
  image?: string;
}

interface Stream {
  server: string;
  link: string;
}

const POPULAR_TAGS = [
  "Naruto", "One Piece", "Attack on Titan", "Demon Slayer", 
  "Jujutsu Kaisen", "Dragon Ball", "Solo Leveling", "Bleach", 
  "Chainsaw Man", "Death Note", "Hunter x Hunter", "My Hero Academia"
];

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Result | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [currentStream, setCurrentStream] = useState<Stream | null>(null);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [activeTab, setActiveTab] = useState<'watchlist' | 'search'>('watchlist');

  // Persistent Watchlist ("All the anime I want")
  const [watchlist, setWatchlist] = useState<Result[]>(() => {
    try {
      const saved = localStorage.getItem('saltstream_watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('saltstream_watchlist', JSON.stringify(watchlist));
    } catch (err) {
      console.error('Failed to save watchlist', err);
    }
  }, [watchlist]);

  const toggleWatchlist = (item: Result, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchlist(prev => {
      const exists = prev.some(i => i.link === item.link);
      if (exists) {
        return prev.filter(i => i.link !== item.link);
      } else {
        return [item, ...prev];
      }
    });
  };

  const isInWatchlist = (link: string) => {
    return watchlist.some(i => i.link === link);
  };

  const handleSearch = async (searchQuery?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery !== undefined ? searchQuery : query;
    if (!q.trim()) return;

    setQuery(q);
    setActiveTab('search');
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEpisodes = async (item: Result) => {
    setSelectedItem(item);
    setEpisodes([]);
    setLoadingEpisodes(true);
    setStreams([]);
    setCurrentStream(null);

    try {
      const res = await fetch(`/api/episodes?url=${encodeURIComponent(item.link)}&source=${item.source}`);
      const data = await res.json();
      setEpisodes(data.episodes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const fetchStreams = async (ep: Episode | Result) => {
    setLoadingStreams(true);
    setStreams([]);
    setCurrentStream(null);

    try {
      const source = selectedItem?.source;
      const res = await fetch(`/api/streams?url=${encodeURIComponent(ep.link)}&source=${source}`);
      const data = await res.json();
      setStreams(data.streams || []);
      if (data.streams?.[0]) {
        setCurrentStream(data.streams[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStreams(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0a0c]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('watchlist')}>
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block leading-none">SaltStream</span>
            <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Anime Portal</span>
          </div>
        </div>

        <form onSubmit={(e) => handleSearch(undefined, e)} className="relative flex-1 max-w-xl mx-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (activeTab !== 'search' && e.target.value.trim()) {
                setActiveTab('search');
              }
            }}
            placeholder="Search all anime, movies, or cartoons..."
            className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all shadow-inner text-white placeholder-slate-500"
          />
        </form>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'watchlist'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === 'watchlist' ? 'fill-white' : 'text-rose-500'}`} />
            <span>My Anime I Want</span>
            <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">
              {watchlist.length}
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
        {/* Quick Search Tags Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Quick Discover & Popular Anime</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => handleSearch(tag)}
                className="px-3.5 py-1.5 bg-white/5 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-white/10 rounded-full text-xs font-medium text-slate-300 hover:text-white transition-all whitespace-nowrap flex-shrink-0"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Switcher / Header Banner */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`text-lg font-bold transition-colors pb-1 border-b-2 ${
                activeTab === 'watchlist'
                  ? 'text-white border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              All the Anime I Want ({watchlist.length})
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`text-lg font-bold transition-colors pb-1 border-b-2 ${
                activeTab === 'search'
                  ? 'text-white border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              Search Results {query ? `("${query}")` : ''}
            </button>
          </div>

          {activeTab === 'watchlist' && watchlist.length > 0 && (
            <span className="text-xs text-slate-500 font-medium">Your pinned anime collection</span>
          )}
          {activeTab === 'search' && results.length > 0 && (
            <span className="text-xs text-slate-500 font-medium">{results.length} matches found</span>
          )}
        </div>

        {/* Main Content Area based on Active Tab */}
        {activeTab === 'watchlist' ? (
          <div className="space-y-6">
            {watchlist.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {watchlist.map((item, i) => (
                  <motion.div
                    key={item.link || i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group relative cursor-pointer"
                    onClick={() => fetchEpisodes(item)}
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 relative shadow-xl">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg">
                          <Play className="w-6 h-6 text-black fill-black ml-1" />
                        </div>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/10 uppercase">
                          {item.source}
                        </span>
                      </div>

                      {/* Heart Button */}
                      <button
                        onClick={(e) => toggleWatchlist(item, e)}
                        className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-rose-600 backdrop-blur-md rounded-full text-rose-500 hover:text-white transition-all border border-white/10 shadow-md group/btn"
                        title="Remove from My Anime"
                      >
                        <Heart className="w-4 h-4 fill-rose-500 group-hover/btn:fill-white" />
                      </button>
                    </div>

                    <div className="mt-3 space-y-1">
                      <h3 className="text-sm font-medium text-slate-200 line-clamp-2 leading-tight group-hover:text-indigo-400 transition-colors">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span className="uppercase">{item.type}</span>
                        <span>·</span>
                        <span>HD</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-28 text-center bg-white/[0.02] border border-white/5 rounded-2xl p-8">
                <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center mb-6 text-indigo-400">
                  <Heart className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Anime in "My Anime I Want" Yet</h3>
                <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
                  Your personal front panel is empty. Search for any anime or click quick tags above, then click the heart icon on any anime card to pin all the anime you want right here in front!
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {POPULAR_TAGS.slice(0, 5).map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      Explore {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-28">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-400 text-sm">Searching multiple streaming sources for "{query}"...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {results.map((result, i) => {
                  const saved = isInWatchlist(result.link);
                  return (
                    <motion.div
                      key={result.link || i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="group relative cursor-pointer"
                      onClick={() => fetchEpisodes(result)}
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 relative shadow-xl">
                        <img
                          src={result.image}
                          alt={result.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg">
                            <Play className="w-6 h-6 text-black fill-black ml-1" />
                          </div>
                        </div>

                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/10 uppercase">
                            {result.source}
                          </span>
                        </div>

                        {/* Heart Button */}
                        <button
                          onClick={(e) => toggleWatchlist(result, e)}
                          className={`absolute top-2 right-2 p-2 backdrop-blur-md rounded-full transition-all border shadow-md group/btn ${
                            saved 
                              ? 'bg-rose-600 text-white border-rose-500' 
                              : 'bg-black/60 text-slate-300 hover:text-white border-white/10 hover:bg-rose-600'
                          }`}
                          title={saved ? "Remove from My Anime" : "Add to My Anime I Want"}
                        >
                          <Heart className={`w-4 h-4 ${saved ? 'fill-white' : 'fill-transparent'}`} />
                        </button>
                      </div>

                      <div className="mt-3 space-y-1">
                        <h3 className="text-sm font-medium text-slate-200 line-clamp-2 leading-tight group-hover:text-indigo-400 transition-colors">
                          {result.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                          <span className="uppercase">{result.type}</span>
                          <span>·</span>
                          <span>HD</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-28 text-center bg-white/[0.02] border border-white/5 rounded-2xl p-8">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 text-slate-500">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No results found for "{query}"</h3>
                <p className="text-slate-400 text-sm max-w-xs mb-6">
                  Try searching for another anime title or pick from our popular discovery tags above.
                </p>
                <button
                  onClick={() => setActiveTab('watchlist')}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  View My Anime I Want ({watchlist.length})
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal / Detail View */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          >
            <div 
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => {
                setSelectedItem(null);
                setCurrentStream(null);
              }}
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl h-full max-h-[85vh] bg-[#121214] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#18181c]">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-white line-clamp-1">{selectedItem.title}</span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-bold uppercase">
                    {selectedItem.source}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => toggleWatchlist(selectedItem, e)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isInWatchlist(selectedItem.link)
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isInWatchlist(selectedItem.link) ? 'fill-white' : ''}`} />
                    <span>{isInWatchlist(selectedItem.link) ? 'In My Anime' : 'Add to My Anime'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedItem(null);
                      setCurrentStream(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col md:flex-row">
                {/* Left Side: Video & Info */}
                <div className="flex-1 p-6 space-y-6">
                  {/* Player Slot */}
                  <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/5 shadow-inner relative group">
                    {currentStream ? (
                      <iframe
                        src={currentStream.link}
                        className="w-full h-full"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-indigo-950/20 to-black">
                        {loadingStreams ? (
                          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-12 h-12 text-slate-700 mb-4" />
                            <p className="text-slate-400 text-sm font-medium">Select an episode on the right to start streaming</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">{selectedItem.title}</h2>
                      <div className="flex items-center gap-2">
                        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="text-indigo-400 font-semibold">{selectedItem.type.toUpperCase()}</span>
                      <span aria-hidden="true">·</span>
                      <span>HD Streaming</span>
                      <span aria-hidden="true">·</span>
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 border border-slate-700 rounded text-[10px]">1080P</span>
                        <span className="px-1.5 py-0.5 border border-slate-700 rounded text-[10px]">CC</span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed">
                      Experience this incredible {selectedItem.type} from {selectedItem.source} with lightning-fast servers and multiple language audio options.
                    </p>
                  </div>

                  {/* Servers */}
                  {streams.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Streaming Servers</h4>
                      <div className="flex flex-wrap gap-2">
                        {streams.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentStream(s)}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                              currentStream?.link === s.link 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {s.server}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Episodes List */}
                <div className="w-full md:w-80 bg-black/30 border-l border-white/5 flex flex-col">
                  <div className="p-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Episodes</h3>
                      <span className="text-[10px] font-bold text-slate-400">{episodes.length} Total</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {loadingEpisodes ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                      </div>
                    ) : episodes.length > 0 ? (
                      episodes.map((ep, i) => (
                        <button
                          key={i}
                          onClick={() => fetchStreams(ep)}
                          className="w-full group flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="relative w-24 aspect-video rounded-md overflow-hidden bg-white/5 flex-shrink-0">
                            {ep.image ? (
                              <img src={ep.image} alt={ep.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Tv className="w-4 h-4 text-slate-600" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            <div className="text-[10px] font-bold text-indigo-400 mb-0.5 uppercase tracking-tight">Episode {ep.epNum}</div>
                            <div className="text-xs font-medium text-slate-300 line-clamp-1 group-hover:text-white transition-colors">
                              {ep.title}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-12 text-center space-y-4 px-4">
                        <p className="text-xs text-slate-400">No episode list or direct feature movie</p>
                        <button 
                          onClick={() => fetchStreams(selectedItem!)}
                          className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
                        >
                          Play Movie Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
