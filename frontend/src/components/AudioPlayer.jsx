import React, { useState, useRef } from 'react';
import axios from 'axios';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const audioRefs = {
    vocals: useRef(null),
    drums: useRef(null),
    bass: useRef(null),
    guitar: useRef(null),
    other: useRef(null)
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const response = await axios.post('http://localhost:8000/separate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setTracks(prev => {
        const newTracks = { ...prev };
        Object.entries(response.data).forEach(([key, url]) => {
          newTracks[key] = { ...prev[key], url: `http://localhost:8000${url}` };
        });
        return newTracks;
      });
    } catch (err) {
      setError('音频处理失败');
      console.error(err);
    } finally {
      setIsLoading(false);
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
          <p>处理中...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          错误: {error}
        </div>
      )}

      <div className="controls">
        <button onClick={togglePlay} disabled={!Object.values(tracks).some(t => t.url)}>
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
            {trackData.url && <audio ref={audioRefs[trackName]} src={trackData.url} />}
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