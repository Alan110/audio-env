import React, { useState, useRef, useEffect } from 'react';

const AudioPlayer = () => {
  const [tracks, setTracks] = useState({
    vocals: { volume: 1, muted: false, url: null },
    drums: { volume: 1, muted: false, url: null },
    bass: { volume: 1, muted: false, url: null },
    guitar: { volume: 1, muted: false, url: null },
    other: { volume: 1, muted: false, url: null }
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRefs = {
    vocals: useRef(null),
    drums: useRef(null),
    bass: useRef(null),
    guitar: useRef(null),
    other: useRef(null)
  };

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    Object.entries(tracks).forEach(([trackName, trackData]) => {
      if (trackData.url && audioRefs[trackName].current) {
        audioRefs[trackName].current.src = trackData.url;
        audioRefs[trackName].current.load();
      }
    });
  }, [tracks]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', file);

      // 创建上传进度监听
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setProgress(Math.round(percentComplete));
        }
      };

      // 发送请求
      const response = await fetch('http://localhost:8000/separate', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('音频分离失败');
      }

      const result = await response.json();
      
      // 更新音轨URL
      setTracks(prev => ({
        vocals: { ...prev.vocals, url: `http://localhost:8000${result.vocals}` },
        drums: { ...prev.drums, url: `http://localhost:8000${result.drums}` },
        bass: { ...prev.bass, url: `http://localhost:8000${result.bass}` },
        guitar: { ...prev.guitar, url: `http://localhost:8000${result.guitar}` },
        other: { ...prev.other, url: `http://localhost:8000${result.other}` }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const togglePlay = () => {
    Object.values(audioRefs).forEach(ref => {
      if (ref.current) {
        if (isPlaying) {
          ref.current.pause();
        } else {
          ref.current.play();
        }
      }
    });
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (track, value) => {
    setTracks(prev => ({
      ...prev,
      [track]: { ...prev[track], volume: value }
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

  // 添加音频同步播放功能
  useEffect(() => {
    const audioElements = Object.values(audioRefs).map(ref => ref.current);
    
    // 确保所有音轨同步播放
    audioElements.forEach(audio => {
      if (audio) {
        audio.addEventListener('play', () => {
          const currentTime = audio.currentTime;
          audioElements.forEach(other => {
            if (other && other !== audio) {
              other.currentTime = currentTime;
              other.play();
            }
          });
        });

        audio.addEventListener('pause', () => {
          audioElements.forEach(other => {
            if (other && other !== audio) {
              other.pause();
            }
          });
        });
      }
    });

    return () => {
      // 清理事件监听
      audioElements.forEach(audio => {
        if (audio) {
          audio.removeEventListener('play', () => {});
          audio.removeEventListener('pause', () => {});
        }
      });
    };
  }, [audioRefs]);

  return (
    <div className="audio-player">
      <input 
        type="file" 
        accept=".mp3,.mp4" 
        onChange={handleFileUpload}
        disabled={isLoading} 
      />
      
      {isLoading && (
        <div className="loading-status">
          <progress value={progress} max="100" />
          <span>处理中... {progress}%</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          错误: {error}
        </div>
      )}

      <div className="controls">
        <button onClick={togglePlay}>
          {isPlaying ? '暂停' : '播放'}
        </button>
        
        <div className="speed-control">
          <label>播放速度：</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={playbackRate}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          />
          <span>{playbackRate}x</span>
        </div>
      </div>

      <div className="tracks">
        {Object.entries(tracks).map(([trackName, trackData]) => (
          <div key={trackName} className="track-control">
            <label>{trackName}</label>
            <audio ref={audioRefs[trackName]} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={trackData.volume}
              onChange={(e) => handleVolumeChange(trackName, parseFloat(e.target.value))}
            />
            <button onClick={() => handleVolumeChange(trackName, trackData.muted ? 1 : 0)}>
              {trackData.muted ? '取消静音' : '静音'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AudioPlayer; 