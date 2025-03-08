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
    <div className="flex flex-col items-center bg-gray-100 p-4 rounded-lg shadow-lg">
      <input 
        type="file" 
        accept=".mp3,.mp4" 
        onChange={handleFileUpload}
        disabled={isLoading} 
        className="px-4 py-2 bg-blue-500 text-white rounded-md mb-4 hover:bg-blue-600"
      />
      
      {isLoading && (
        <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow mt-4">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v1a7 7 0 00-7 7h1a5 5 0 01-5-5z"></path>
          </svg>
          <p className="text-blue-500 text-lg">处理中...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 text-red-500 rounded-lg shadow mt-4">
          错误: {error}
        </div>
      )}

      <div className="flex flex-col w-full mt-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-4">
          <button 
            onClick={togglePlay} 
            disabled={!Object.values(tracks).some(t => t.url)}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            {isPlaying ? '暂停' : '播放'}
          </button>
          <div className="flex items-center">
            <label className="mr-2 text-gray-600">播放速度：</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={playbackRate}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="mr-2"
            />
            <span className="text-gray-600">{playbackRate}x</span>
          </div>
        </div>

        <div className="flex flex-col w-full">
          {Object.entries(tracks).map(([trackName, trackData]) => (
            <div 
              key={trackName} 
              className="flex items-center justify-between p-4 bg-white rounded-lg shadow mb-2"
            >
              <div className="flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={trackData.volume}
                  onChange={(e) => handleVolumeChange(trackName, parseFloat(e.target.value))}
                  className="mr-4 w-48"
                />
                <button 
                  onClick={() => handleVolumeChange(trackName, trackData.muted ? 1 : 0)}
                  className={`px-4 py-2 rounded-md ${trackData.muted ? 'bg-red-500' : 'bg-gray-300'} text-white hover:bg-opacity-90`}
                >
                  {trackData.muted ? '取消静音' : '静音'}
                </button>
              </div>
              <h3 className="text-lg font-medium mr-4">{trackName}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
