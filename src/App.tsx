import React, { useState, useEffect } from 'react';
import { Search, Play, Info, X, Loader2, Download, Tv, MonitorPlay } from 'lucide-react';
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">SaltStream</span>
        </div>

        <form onSubmit={handleSearch} className="relative flex-1 max-w-xl mx-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime, cartoons, or movies..."
            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </form>

        <div className="flex items-center gap-4">
          <button className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Trending</button>
          <button className="px-4 py-2 text-xs font-semibold bg-white text-black rounded-full hover:bg-slate-200 transition-colors">Sign In</button>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-8">
        {/* Results Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {loading ? 'Searching...' : results.length > 0 ? `Results for "${query}"` : 'Discover'}
            </h2>
            {results.length > 0 && (
              <span className="text-xs text-slate-500">{results.length} results found</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {results.map((result, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative cursor-pointer"
                  onClick={() => fetchEpisodes(result)}
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/5 relative shadow-2xl">
                    <img
                      src={result.image}
                      alt={result.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-300">
                        <Play className="w-6 h-6 text-black fill-black ml-1" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/10 uppercase">
                        {result.source}
                      </span>
                    </div>
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
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Start your search</h3>
              <p className="text-slate-500 text-sm max-w-xs">
                Search for your favorite anime, cartoons, or movies from multiple sources.
              </p>
            </div>
          )}
        </div>
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
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white line-clamp-1">{selectedItem.title}</span>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-bold uppercase">
                    {selectedItem.source}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedItem(null);
                    setCurrentStream(null);
                  }}
                  className="p-1 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                        {loadingStreams ? (
                          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-12 h-12 text-slate-800 mb-4" />
                            <p className="text-slate-500 text-sm">Select an episode to start streaming</p>
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
                        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="text-indigo-400 font-semibold">{selectedItem.type.toUpperCase()}</span>
                      <span aria-hidden="true">·</span>
                      <span>2024</span>
                      <span aria-hidden="true">·</span>
                      <div className="flex items-center gap-1">
                        <span className="px-1 border border-slate-700 rounded text-[10px]">1080P</span>
                        <span className="px-1 border border-slate-700 rounded text-[10px]">CC</span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                      Experience this amazing {selectedItem.type} from {selectedItem.source}. 
                      Watch with multiple servers and high quality streaming options.
                    </p>
                  </div>

                  {/* Servers */}
                  {streams.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Servers</h4>
                      <div className="flex flex-wrap gap-2">
                        {streams.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentStream(s)}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                              currentStream?.link === s.link 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
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
                <div className="w-full md:w-80 bg-black/20 border-l border-white/5 flex flex-col">
                  <div className="p-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Episodes</h3>
                      <span className="text-[10px] font-bold text-slate-500">{episodes.length} Total</span>
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
                                <Tv className="w-4 h-4 text-slate-700" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            <div className="text-[10px] font-bold text-indigo-500 mb-0.5 uppercase tracking-tighter">Episode {ep.epNum}</div>
                            <div className="text-xs font-medium text-slate-300 line-clamp-1 group-hover:text-white transition-colors">
                              {ep.title}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-10 text-center space-y-4">
                        <p className="text-xs text-slate-600">No episodes found or direct movie</p>
                        <button 
                          onClick={() => fetchStreams(selectedItem!)}
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Watch Now
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
