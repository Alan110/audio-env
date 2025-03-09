import { useState, useRef, useEffect } from 'react';

export const useAudioHook = () => {
  const [cacheMode, setCacheMode] = useState(true);
  const [tracks, setTracks] = useState({
    vocals: { volume: 1, muted: false, lastVolume: 1, url: null },
    drums: { volume: 1, muted: false, lastVolume: 1, url: null },
    bass: { volume: 1, muted: false, lastVolume: 1, url: null },
    guitar: { volume: 1, muted: false, lastVolume: 1, url: null },
    other: { volume: 1, muted: false, lastVolume: 1, url: null }
  });
  
  const [playbackRate, setPlaybackRate] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isSettingTime, setIsSettingTime] = useState(false);
  const wasPlayingRef = useRef(false);

  const audioRefs = {
    vocals: useRef(null),
    drums: useRef(null),
    bass: useRef(null),
    guitar: useRef(null),
    other: useRef(null)
  };

  // 音频URL变化时加载音频
  useEffect(() => {
    Object.entries(tracks).forEach(([trackName, trackData]) => {
      const audio = audioRefs[trackName].current;
      if (audio && trackData.url) {
        const fullUrl = `http://localhost:8000${trackData.url}`;
        if (audio.src !== fullUrl) {
          audio.src = fullUrl;
          audio.load();
        }
        // 同步音频状态
        audio.volume = trackData.volume;
        audio.muted = trackData.muted;
        audio.playbackRate = playbackRate;
      }
    });
  }, [tracks]);

  // 音频事件监听
  useEffect(() => {
    const audioElements = Object.values(audioRefs).map(ref => ref.current);
    if (!audioElements.length) return;

    const handleTimeUpdate = (event) => {
      if (!isSettingTime) {
        const newTime = event.target.currentTime;
        setCurrentTime(newTime);
        setDuration(event.target.duration);
      }
    };

    const handleLoadedMetadata = (event) => {
      setDuration(event.target.duration);
    };

    audioElements.forEach(audio => {
      if (audio) {
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      }
    });

    return () => {
      audioElements.forEach(audio => {
        if (audio) {
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      });
    };
  }, [isSettingTime]);

  const syncAudioTimes = (time) => {
    Object.values(audioRefs).forEach(ref => {
      const audio = ref.current;
      if (audio && !audio.muted && Math.abs(audio.currentTime - time) > 0.1) {
        audio.currentTime = time;
      }
    });
  };

  const togglePlay = async () => {
    try {
      const audioElements = Object.values(audioRefs).map(ref => ref.current);
      
      if (isPlaying) {
        audioElements.forEach(audio => {
          if (audio && !audio.muted) {
            audio.pause();
          }
        });
      } else {
        // 播放所有非静音的音轨
        await Promise.all(
          audioElements.map(async (audio) => {
            if (audio && audio.src && !audio.muted) {
              try {
                await audio.play();
              } catch (err) {
                console.error('播放错误:', err);
              }
            }
          })
        );
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      setError('播放失败，请重试');
      console.error('播放错误:', err);
    }
  };

  const toggleMute = (track) => {
    const audioElement = audioRefs[track].current;
    if (!audioElement) return;

    setTracks(prev => {
      const trackData = prev[track];
      const newMuted = !trackData.muted;
      
      // 直接设置audio元素的muted属性
      audioElement.muted = newMuted;
      
      // 如果取消静音，同步到当前播放位置
      if (!newMuted) {
        const currentPos = currentTime;
        audioElement.currentTime = currentPos;
        
        // 如果当前正在播放，则开始播放这个音轨
        if (isPlaying) {
          audioElement.play().catch(console.error);
        }
      }

      return {
        ...prev,
        [track]: {
          ...trackData,
          muted: newMuted
        }
      };
    });
  };

  const handleVolumeChange = (track, value) => {
    const audioElement = audioRefs[track].current;
    if (audioElement) {
      audioElement.volume = value;
    }

    setTracks(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        volume: value,
        lastVolume: value > 0 ? value : prev[track].lastVolume
      }
    }));
  };

  const handleSeek = (time) => {
    if (isSettingTime) return;
    
    setIsSettingTime(true);
    try {
      // 保存当前播放状态
      wasPlayingRef.current = isPlaying;
      
      // 如果正在播放，暂时暂停所有音轨
      if (isPlaying) {
        Object.values(audioRefs).forEach(ref => {
          const audio = ref.current;
          if (audio && !audio.muted) {
            audio.pause();
          }
        });
      }

      // 设置新的播放位置
      Object.values(audioRefs).forEach(ref => {
        const audio = ref.current;
        if (audio && !audio.muted) {
          audio.currentTime = time;
        }
      });
      setCurrentTime(time);

      // 如果之前在播放，恢复播放
      if (wasPlayingRef.current) {
        Object.values(audioRefs).forEach(ref => {
          const audio = ref.current;
          if (audio && !audio.muted) {
            audio.play().catch(console.error);
          }
        });
      }
    } finally {
      setIsSettingTime(false);
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
        updatedTracks[key] = { ...prev[key], url };
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
    currentTime,
    duration,
    audioRefs,
    cacheMode,
    setCacheMode,
    setIsLoading,
    setError,
    setProgress,
    togglePlay,
    handleVolumeChange,
    handleSpeedChange,
    updateTracks,
    toggleMute,
    handleSeek
  };
};
