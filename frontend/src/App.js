import React from 'react';
import AudioPlayer from './components/AudioPlayer';
import './styles/tailwind.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transform hover:scale-105 transition-transform duration-300 animate-fade-in">
          音轨分离训练系统
        </h1>
        <AudioPlayer />
      </div>
    </div>
  );
}

export default App;
