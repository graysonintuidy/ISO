'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Camera,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Circle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import styles from './VideoPlayer.module.css';

/**
 * VideoPlayer — Reusable video player component.
 *
 * Renders an HLS video stream when `streamUrl` is provided,
 * otherwise displays a premium placeholder with camera status.
 *
 * Props:
 * - streamUrl: string | null — HLS/MP4 stream URL
 * - cameraName: string — Display name for the camera
 * - cameraId: string — Camera ID
 * - status: 'online' | 'offline' | 'pending_setup' | 'maintenance'
 * - showControls: boolean — Show playback controls (default: true)
 * - showLabel: boolean — Show camera name overlay (default: true)
 * - autoPlay: boolean — Auto-play video (default: true)
 * - muted: boolean — Start muted (default: true)
 * - compact: boolean — Compact mode for grid tiles (default: false)
 * - onClickFeed: function — Callback when player is clicked
 * - timestamp: string — Optional timestamp to display
 */
const VideoPlayer = forwardRef(function VideoPlayer(
  {
    streamUrl = null,
    cameraName = 'Camera',
    cameraId,
    status = 'pending_setup',
    showControls = true,
    showLabel = true,
    autoPlay = true,
    muted: initialMuted = true,
    compact = false,
    onClickFeed,
    timestamp,
    posterImage = null,
  },
  ref
) {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(!!streamUrl);

  const hasStream = !!streamUrl && !videoError;

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        videoRef.current?.play();
        setIsPlaying(true);
      },
      pause: () => {
        videoRef.current?.pause();
        setIsPlaying(false);
      },
      toggleMute: () => setIsMuted((prev) => !prev),
      toggleFullscreen: handleFullscreen,
      screenshot: handleScreenshot,
      toggleRecording: () => setIsRecording((prev) => !prev),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Play/pause toggle
  const handlePlayPause = useCallback(
    (e) => {
      e?.stopPropagation();
      if (!hasStream) return;
      if (isPlaying) {
        videoRef.current?.pause();
        setIsPlaying(false);
      } else {
        videoRef.current?.play();
        setIsPlaying(true);
      }
    },
    [hasStream, isPlaying]
  );

  // Mute toggle
  const handleMute = useCallback((e) => {
    e?.stopPropagation();
    setIsMuted((prev) => !prev);
  }, []);

  // Fullscreen toggle
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function handleFullscreen(e) {
    e?.stopPropagation();
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }

  // Screenshot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function handleScreenshot(e) {
    e?.stopPropagation();
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const link = document.createElement('a');
    link.download = `${cameraName.replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // Recording toggle
  const handleRecordToggle = useCallback((e) => {
    e?.stopPropagation();
    setIsRecording((prev) => !prev);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Apply muted state to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Status styling map
  const statusClass = {
    online: styles.statusOnline,
    offline: styles.statusOffline,
    pending_setup: styles.statusPending,
    maintenance: styles.statusMaintenance,
  }[status] || styles.statusOffline;

  const statusText = {
    online: 'Live',
    offline: 'Offline',
    pending_setup: 'Pending',
    maintenance: 'Maintenance',
  }[status] || 'Offline';

  const wrapperClasses = [
    styles.playerWrapper,
    compact && styles.compact,
    isFullscreen && styles.fullscreen,
  ]
    .filter(Boolean)
    .join(' ');

  const handleWrapperClick = useCallback(() => {
    if (onClickFeed) {
      onClickFeed(cameraId);
    }
  }, [onClickFeed, cameraId]);

  // Generate a stable mock timestamp for display
  const displayTimestamp =
    timestamp ||
    (status === 'online'
      ? new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClasses}
      onClick={handleWrapperClick}
      tabIndex={0}
      role="button"
      aria-label={`${cameraName} video feed`}
    >
      {/* Video Element */}
      {hasStream && (
        <video
          ref={videoRef}
          className={styles.videoElement}
          src={streamUrl}
          autoPlay={autoPlay}
          muted={isMuted}
          playsInline
          loop
          onLoadedData={() => setVideoLoading(false)}
          onError={() => {
            setVideoError(true);
            setVideoLoading(false);
          }}
        />
      )}

      {/* Loading State */}
      {videoLoading && hasStream && (
        <div className={styles.loadingOverlay}>
          <span className="loading-spinner" />
        </div>
      )}

      {/* Error State */}
      {videoError && (
        <div className={styles.errorOverlay}>
          <WifiOff size={24} style={{ color: '#fca5a5' }} />
          <span className={styles.errorText}>Stream unavailable</span>
        </div>
      )}

      {/* Placeholder (when no stream) */}
      {!hasStream && !videoError && (
        <div
          className={styles.placeholder}
          style={posterImage ? {
            backgroundImage: `url(${posterImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : undefined}
        >
          {!posterImage && (
            <Camera
              size={compact ? 28 : 40}
              className={styles.placeholderIcon}
            />
          )}
          {!compact && !posterImage && (
            <>
              <p className={styles.placeholderText}>
                {status === 'pending_setup'
                  ? 'Camera feed not configured'
                  : status === 'offline'
                  ? 'Camera offline'
                  : status === 'maintenance'
                  ? 'Maintenance mode'
                  : 'Connecting...'}
              </p>
              <button
                className={styles.connectBtn}
                onClick={(e) => e.stopPropagation()}
              >
                <Wifi size={12} />
                Connect Stream
              </button>
            </>
          )}
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className={styles.recordingIndicator}>
          <span className={styles.recordingDot} />
          <span className={styles.recordingLabel}>
            REC
          </span>
        </div>
      )}

      {/* Status Badge */}
      <span className={`${styles.statusBadge} ${statusClass}`}>
        {statusText}
      </span>

      {/* Camera Name Label */}
      {showLabel && (
        <div className={styles.cameraLabel}>
          <span className={styles.cameraName}>{cameraName}</span>
          {displayTimestamp && (
            <span className={styles.cameraTimestamp}>{displayTimestamp}</span>
          )}
        </div>
      )}

      {/* Playback Controls */}
      {showControls && (
        <div
          className={`${styles.controlsOverlay} ${
            isFullscreen ? styles.controlsAlwaysVisible : ''
          }`}
        >
          {hasStream && (
            <button
              className={styles.controlBtn}
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}

          <button
            className={styles.controlBtn}
            onClick={handleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {hasStream && (
            <button
              className={`${styles.controlBtn} ${
                isRecording ? styles.controlBtnActive : ''
              }`}
              onClick={handleRecordToggle}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <Circle size={14} />
            </button>
          )}

          <span className={styles.controlSpacer} />

          {hasStream && (
            <button
              className={styles.controlBtn}
              onClick={handleScreenshot}
              aria-label="Screenshot"
            >
              <Download size={14} />
            </button>
          )}

          <button
            className={styles.controlBtn}
            onClick={handleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
