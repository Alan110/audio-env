import React, { useMemo } from 'react';
import { useAudioHook } from '../hooks/useAudioHook';
import { uploadFile } from '../utils/fileUploader';

const AudioPlayer = () => {
  const {
    tracks,
    playbackRate,
    isPlaying,
    isLoading,
    error,
    progress,
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
    handleSeek,
    currentTime,
    duration
  } = useAudioHook();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await uploadFile(
        file,
        (progress) => setProgress(progress),
        (error) => setError(error),
        cacheMode
      );
      updateTracks(result);
    } catch (err) {
      console.error('上传错误:', err);
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-blue-500 text-lg">处理中... {progress}%</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 text-red-500 rounded-lg shadow mt-4">
          错误: {error}
        </div>
      )}

      <div className="flex flex-col w-full mt-4">
        {/* 进度条 */}
        <div className="w-full bg-white p-4 rounded-lg shadow mb-4">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime || 0}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-4">
          <button 
            onClick={togglePlay} 
            disabled={!Object.values(tracks).some(t => t.url)}
            className={`px-4 py-2 ${
              Object.values(tracks).some(t => t.url)
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-gray-400 cursor-not-allowed'
            } text-white rounded-md`}
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
              <div className="flex items-center flex-1">
                <h3 className="text-lg font-medium mr-4 w-20">{trackName}</h3>
                <div className="flex-1 mx-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={trackData.volume}
                    onChange={(e) => handleVolumeChange(trackName, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <button 
                  onClick={() => toggleMute(trackName)}
                  className={`px-4 py-2 rounded-md ${
                    trackData.muted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 hover:bg-gray-400'
                  } text-white min-w-[80px]`}
                >
                  {trackData.muted ? '取消静音' : '静音'}
                </button>
              </div>
              <audio ref={audioRefs[trackName]} preload="auto" />
            </div>
          ))}
        </div>

        {/* 调试面板 */}
        <div className="mt-4 p-4 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-700 mb-2">调试选项</h3>
          <div className="flex items-center">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={cacheMode}
                onChange={(e) => setCacheMode(e.target.checked)}
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-700">启用缓存模式</span>
            </label>
            <div className="ml-2 text-sm text-gray-500">
              {cacheMode ? '（相同文件将使用缓存结果）' : '（每次都重新处理）'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 格式化时间为 mm:ss 格式
const formatTime = (time) => {
  if (!time) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default AudioPlayer;
