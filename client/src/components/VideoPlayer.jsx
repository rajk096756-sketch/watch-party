import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize, Loader2, SkipForward } from 'lucide-react';

export default function VideoPlayer({ 
  src, 
  title, 
  onNext, 
  onTimeUpdateCallback, 
  onPlayCallback, 
  onPauseCallback, 
  onSeekCallback,
  isWatchParty = false,
  roleIsHost = true
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [currentSrc, setCurrentSrc] = useState(src);
  const [inputUrl, setInputUrl] = useState(src || '');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastTap, setLastTap] = useState({ time: 0, x: 0 });
  const [gestureFeedback, setGestureFeedback] = useState({ show: false, text: '', side: '' });
  const [videoType, setVideoType] = useState('direct'); // 'direct' or 'youtube'
  const [youtubeId, setYoutubeId] = useState(null);
  const [error, setError] = useState(null);

  // Extract YouTube ID from URL
  const extractYoutubeId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Reset play state and update source if parent src changes
  useEffect(() => {
    if (src) {
      setInputUrl(src);
      setPlaying(false);
      setCurrentTime(0);
      setBuffering(false);
      setError(null);
      
      const ytId = extractYoutubeId(src);
      if (ytId) {
        setVideoType('youtube');
        setYoutubeId(ytId);
        setCurrentSrc(null);
      } else {
        setVideoType('direct');
        setYoutubeId(null);
        setCurrentSrc(src);
      }
    }
  }, [src]);

  // Handle loading custom direct streams
  const handleLoadUrl = (e) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) return;

    if (isWatchParty && !roleIsHost) return; // only host can load custom streams

    setPlaying(false);
    setBuffering(true);
    setCurrentTime(0);
    setError(null);

    const ytId = extractYoutubeId(inputUrl);
    if (ytId) {
      setVideoType('youtube');
      setYoutubeId(ytId);
      setCurrentSrc(null);
      setBuffering(false);
      if (onPlayCallback) onPlayCallback(0);
    } else {
      setVideoType('direct');
      setYoutubeId(null);
      setCurrentSrc(inputUrl);

      // Forces HTML5 video element to load new source stream
      if (videoRef.current) {
        videoRef.current.src = inputUrl;
        videoRef.current.load();
        videoRef.current.play().catch(() => {
          setError('Unable to play this video URL. Please check if the URL is valid and accessible.');
          setBuffering(false);
        });
      }
    }
  };

  // Controls auto-hide timeout
  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      return;
    }
    const delay = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    return () => clearTimeout(delay);
  }, [showControls, playing]);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Format seconds to MM:SS
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play/Pause Action
  const togglePlay = () => {
    if (isWatchParty && !roleIsHost) return; // Only host controls

    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
      if (onPauseCallback) onPauseCallback(videoRef.current.currentTime);
    } else {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
      if (onPlayCallback) onPlayCallback(videoRef.current.currentTime);
    }
    setShowControls(true);
  };

  // Skip actions
  const skip = (seconds) => {
    if (isWatchParty && !roleIsHost) return;
    let newTime = videoRef.current.currentTime + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > duration) newTime = duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (onSeekCallback) onSeekCallback(newTime);
    setShowControls(true);
  };

  // Seek bar action
  const handleSeekChange = (e) => {
    if (isWatchParty && !roleIsHost) return;
    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    if (onSeekCallback) onSeekCallback(seekTime);
  };

  // Volume control
  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    videoRef.current.volume = vol;
    setMuted(vol === 0);
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    videoRef.current.muted = newMuted;
  };

  // Fullscreen trigger
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Touch double tap gesture handler (left vs right screen skip triggers)
  const handleTouchStart = (e) => {
    if (isWatchParty && !roleIsHost) return;
    
    const now = Date.now();
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = touch.clientX - rect.left;
    const isLeft = clickX < rect.width / 2;

    const timeDiff = now - lastTap.time;
    
    // Double tap within 300ms
    if (timeDiff < 300 && Math.abs(clickX - lastTap.x) < 50) {
      if (isLeft) {
        skip(-10);
        triggerGestureFeedback('-10s', 'left');
      } else {
        skip(10);
        triggerGestureFeedback('+10s', 'right');
      }
    }

    setLastTap({ time: now, x: clickX });
  };

  const triggerGestureFeedback = (text, side) => {
    setGestureFeedback({ show: true, text, side });
    setTimeout(() => {
      setGestureFeedback({ show: false, text: '', side: '' });
    }, 8000); // fade out feedback
  };

  // Event handlers from video element
  const handleTimeUpdate = () => {
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    if (onTimeUpdateCallback) {
      onTimeUpdateCallback(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleError = (e) => {
    console.error('Video error:', e);
    setError('Failed to load video. Please check the URL and try again.');
    setBuffering(false);
    setPlaying(false);
  };

  const handleEnded = () => {
    setPlaying(false);
    if (onNext) {
      onNext();
    }
  };

  // External state synchronization for Watch Party
  // Expose play/pause states via video DOM
  useEffect(() => {
    if (isWatchParty && videoRef.current) {
      // Custom sync handling
      // We will listen to external events mapped outside this component
    }
  }, [isWatchParty]);

  return (
    <div className="flex flex-col gap-3">
      {/* Dynamic URL Loader bar */}
      <form onSubmit={handleLoadUrl} className="flex gap-2 items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs">
        <span className="font-bold text-slate-500 shrink-0">Load Stream URL:</span>
        <input
          type="text"
          placeholder="Paste any video URL (YouTube, MP4, Vimeo, etc.)..."
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          disabled={isWatchParty && !roleIsHost}
          className="flex-grow bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={isWatchParty && !roleIsHost}
          className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all shrink-0 active:scale-95 cursor-pointer"
        >
          Load Stream
        </button>
      </form>

      <div 
        ref={containerRef}
        className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group select-none shadow-2xl"
        onMouseMove={() => setShowControls(true)}
        onTouchStart={handleTouchStart}
      >
        {/* Video Element - Direct or YouTube */}
        {videoType === 'youtube' && youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&controls=1&rel=0&modestbranding=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video player"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentSrc}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onEnded={handleEnded}
            onError={handleError}
            onClick={togglePlay}
            playsInline
            controls={videoType === 'direct'}
          />
        )}

      {/* Buffering/Loading Indicator */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="text-center p-6">
            <Loader2 className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-white text-sm mb-2">Video Error</p>
            <p className="text-slate-300 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Touch Gesture Feedback Overlay */}
      {gestureFeedback.show && (
        <div 
          className={`absolute top-0 bottom-0 flex items-center justify-center w-1/3 bg-white/10 pointer-events-none transition-opacity duration-300 ${
            gestureFeedback.side === 'left' ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'
          }`}
        >
          <span className="text-white text-2xl font-bold bg-black/60 px-4 py-2 rounded-full animate-ping">
            {gestureFeedback.text}
          </span>
        </div>
      )}

      {/* Custom Control Overlays */}
      <div 
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex flex-col gap-3 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            disabled={isWatchParty && !roleIsHost}
            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2 transition-all"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause - Only for direct videos */}
            {videoType === 'direct' && (
              <button 
                onClick={togglePlay}
                disabled={isWatchParty && !roleIsHost}
                className="text-white hover:text-brand-300 disabled:opacity-50 transition-all p-1"
              >
                {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </button>
            )}
            {videoType === 'youtube' && (
              <div className="text-white text-xs flex items-center gap-2">
                <span>▶ YouTube Player</span>
              </div>
            )}

            {/* Skip Backward */}
            <button 
              onClick={() => skip(-10)}
              disabled={isWatchParty && !roleIsHost}
              className="text-white hover:text-brand-300 disabled:opacity-50 transition-all"
              title="Rewind 10s"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Skip Forward */}
            <button 
              onClick={() => skip(10)}
              disabled={isWatchParty && !roleIsHost}
              className="text-white hover:text-brand-300 disabled:opacity-50 transition-all"
              title="Skip 10s"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Time Tracker */}
            <span className="text-white text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="text-white text-sm font-semibold max-w-[200px] truncate md:max-w-[400px]">
            {title} {isWatchParty && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">Watch Party ({roleIsHost ? 'Host' : 'Viewer'})</span>}
          </div>

          <div className="flex items-center gap-4">
            {/* Volume slider */}
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="text-white hover:text-brand-300 transition-all">
                {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-brand-500 group-hover/volume:h-1.5 transition-all"
              />
            </div>

            {/* Autoplay Trigger Notification */}
            {onNext && (
              <button 
                onClick={onNext}
                className="text-white hover:text-brand-300 transition-all"
                title="Next Video"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-brand-300 transition-all">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Host Controls lock message for viewers */}
      {isWatchParty && !roleIsHost && showControls && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-yellow-400 border border-yellow-500/30 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
          <Pause className="w-3.5 h-3.5 fill-current" /> Only the Room Host can control playback.
        </div>
      )}
      </div>
    </div>
  );
}
