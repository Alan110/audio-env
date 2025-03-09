import { useState, useRef, useEffect } from 'react';

export const useAudioHook = () => {
  const [tracks, setTracks] = useState({
    vocals: { volume: 1, muted: false, url: null },
    drums: { volume: 1, muted: false, url: null },
    bass: { volume: 1, muted: false, url: null },
    guitar: { volume: 1, muted: false, url: null },
    other: { volume: 1, muted: false, url: null }
  });
  
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const audioRefs = {
    vocals: useRef(null),
    drums: useRef(null),
    bass: useRef(null),
    guitar: useRef(null),
    other: useRef(null)
  };

  // 音频加载和同步
  useEffect(() => {
    Object.entries(tracks).forEach(([trackName, trackData]) => {
      if (trackData.url && audioRefs[trackName].current) {
        audioRefs[trackName].current.src = trackData.url;
        audioRefs[trackName].current.load();
      }
    });
  }, [tracks]);

  // 音频同步播放控制
  useEffect(() => {
    const audioElements = Object.values(audioRefs).map(ref => ref.current);
    let isSettingTime = false;

    const syncTime = (sourceTime) => {
      if (isSettingTime) return;
      isSettingTime = true;
      audioElements.forEach(audio => {
        if (audio && Math.abs(audio.currentTime - sourceTime) > 0.1) {
          audio.currentTime = sourceTime;
        }
      });
      isSettingTime = false;
    };

    const handleTimeUpdate = (event) => {
      if (!isPlaying) return;
      syncTime(event.target.currentTime);
    };

    const handlePlay = (event) => {
      const currentTime = event.target.currentTime;
      audioElements.forEach(audio => {
        if (audio && audio !== event.target) {
          audio.currentTime = currentTime;
          audio.play().catch(() => {
            // 处理自动播放策略限制
            audio.muted = true;
            audio.play().then(() => {
              audio.muted = false;
            });
          });
        }
      });
      setIsPlaying(true);
    };

    const handlePause = (event) => {
      audioElements.forEach(audio => {
        if (audio && audio !== event.target) {
          audio.pause();
        }
      });
      setIsPlaying(false);
    };

    // 添加事件监听
    audioElements.forEach(audio => {
      if (audio) {
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
      }
    });

    // 清理事件监听
    return () => {
      audioElements.forEach(audio => {
        if (audio) {
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('play', handlePlay);
          audio.removeEventListener('pause', handlePause);
        }
      });
    };
  }, [isPlaying, audioRefs]);

  const togglePlay = async () => {
    const audioElements = Object.values(audioRefs).map(ref => ref.current);
    
    try {
      if (isPlaying) {
        audioElements.forEach(audio => audio?.pause());
      } else {
        // 确保所有音轨都已加载
        const loadPromises = audioElements.map(audio => {
          if (audio && audio.src) {
            return new Promise((resolve) => {
              if (audio.readyState >= 2) {
                resolve();
              } else {
                audio.addEventListener('canplay', resolve, { once: true });
              }
            });
          }
          return Promise.resolve();
        });

        await Promise.all(loadPromises);
        
        // 处理自动播放策略
        const playPromises = audioElements.map(async (audio) => {
          if (audio && audio.src) {
            try {
              await audio.play();
            } catch (err) {
              // 如果直接播放失败，尝试静音播放然后取消静音
              audio.muted = true;
              await audio.play();
              audio.muted = false;
            }
          }
        });

        await Promise.all(playPromises);
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      setError('播放失败，请重试');
      console.error('播放错误:', err);
    }
  };

  const handleVolumeChange = (track, value) => {
    setTracks(prev => ({
      ...prev,
      [track]: { ...prev[track], volume: value, muted: value === 0 }
    }));
    if (audioRefs[track].current) {
      audioRefs[track].current.volume = value;
    }
  };

  const handleSpeedChange = (value) => {
    setPlaybackRate(value);
    Object.values(audioRefs).forEach(ref => {
      if (ref.current) {
        ref.current.playbackRate = value;
      }
    });
  };

  const updateTracks = (newTracks) => {
    setTracks(prev => {
      const updatedTracks = { ...prev };
      Object.entries(newTracks).forEach(([key, url]) => {
        updatedTracks[key] = { ...prev[key], url: `http://localhost:8000${url}` };
      });
      return updatedTracks;
    });
  };

  return {
    tracks,
    playbackRate,
    isPlaying,
    isLoading,
    error,
    progress,
    audioRefs,
    setIsLoading,
    setError,
    setProgress,
    togglePlay,
    handleVolumeChange,
    handleSpeedChange,
    updateTracks
  };
};
