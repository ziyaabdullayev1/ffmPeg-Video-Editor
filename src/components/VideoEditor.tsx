'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Square, Upload, Download, Scissors, Zap, RotateCcw } from 'lucide-react'
import VideoRecorder from './VideoRecorder'
import VideoPlayer from './VideoPlayer'
import VideoEditControls from './VideoEditControls'
import FileManager from './FileManager'

interface VideoFile {
  id: string
  name: string
  url: string
  duration: number
  size: number
  createdAt: Date
}

export default function VideoEditor() {
  const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null)
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [activeTab, setActiveTab] = useState<'record' | 'edit' | 'files'>('record')
  const [isProcessing, setIsProcessing] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(30)
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)

  const handleVideoRecorded = (videoBlob: Blob) => {
    const url = URL.createObjectURL(videoBlob)
    const newVideo: VideoFile = {
      id: Date.now().toString(),
      name: `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`,
      url,
      duration: 0, // Will be updated when video loads
      size: videoBlob.size,
      createdAt: new Date()
    }
    setVideos(prev => [newVideo, ...prev])
    setCurrentVideo(newVideo)
    setActiveTab('edit')
  }

  const handleVideoSelect = (video: VideoFile) => {
    console.log('VideoEditor: Selecting new video:', video.name)
    setCurrentVideo(video)
    setActiveTab('edit')
    // Reset all states when selecting a new video
    setTrimStart(0)
    setTrimEnd(30) // Set to default, will be corrected when duration loads
    setVideoDuration(0) // Reset duration, will be loaded by VideoPlayer
    setCurrentVideoTime(0) // Reset playback time
  }

  const handleVideoDelete = (videoId: string) => {
    // Find the video to clean up its blob URL
    const videoToDelete = videos.find(v => v.id === videoId)
    if (videoToDelete) {
      URL.revokeObjectURL(videoToDelete.url)
    }
    
    // Remove from videos array
    setVideos(prev => prev.filter(v => v.id !== videoId))
    
    // If the deleted video was currently selected, clear selection
    if (currentVideo?.id === videoId) {
      setCurrentVideo(null)
      setActiveTab('record')
    }
  }

  const handleVideoProcessed = (processedBlob: Blob, filename: string) => {
    try {
      console.log('Processing video blob:', {
        size: processedBlob.size,
        type: processedBlob.type
      })

      if (!processedBlob || processedBlob.size === 0) {
        throw new Error('Received empty video blob')
      }

      const url = URL.createObjectURL(processedBlob)
      console.log('Created blob URL:', url)

      const newVideo: VideoFile = {
        id: Date.now().toString(),
        name: filename,
        url,
        duration: 0,
        size: processedBlob.size,
        createdAt: new Date()
      }
      
      setVideos(prev => [newVideo, ...prev])
      setCurrentVideo(newVideo)
      
      // Test the blob URL immediately
      const testVideo = document.createElement('video')
      testVideo.src = url
      testVideo.addEventListener('loadedmetadata', () => {
        console.log('Blob URL is valid, video duration:', testVideo.duration)
      })
      testVideo.addEventListener('error', (e) => {
        console.error('Blob URL test failed:', e)
      })
      testVideo.load()
      
    } catch (error) {
      console.error('Error handling processed video:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to process video'}`)
    }
  }

  const handleVideoTimeUpdate = (currentTime: number) => {
    setCurrentVideoTime(currentTime)
  }

  const handleVideoDurationChange = (duration: number) => {
    console.log('VideoEditor: Received duration', duration, 'for video', currentVideo?.name)
    setVideoDuration(duration)
    
    // Reset trim end if it exceeds the actual duration
    if (trimEnd > duration) {
      const newEnd = Math.min(duration, 30)
      console.log('VideoEditor: Resetting trim end from', trimEnd, 'to', newEnd)
      setTrimEnd(newEnd)
    }
  }



  const handleTrimDataChange = (start: number, end: number) => {
    setTrimStart(start)
    setTrimEnd(end)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Video Editor</h1>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('record')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'record'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Record
              </button>
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'edit'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={!currentVideo}
              >
                Edit
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'files'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Files
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="bg-blue-500 h-1">
          <div className="bg-blue-600 h-1 animate-pulse"></div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2">
            {activeTab === 'record' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">Record Video</h2>
                <VideoRecorder onVideoRecorded={handleVideoRecorded} />
              </div>
            )}

            {activeTab === 'edit' && currentVideo && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-4 text-gray-900">Video Player</h2>
                  <VideoPlayer 
                    video={currentVideo} 
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onDurationChange={handleVideoDurationChange}
                    showTrimMarkers={true}
                  />
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-4 text-gray-900">Edit Controls</h2>
                  <VideoEditControls 
                    video={currentVideo} 
                    onVideoProcessed={handleVideoProcessed}
                    setIsProcessing={setIsProcessing}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    onTrimDataChange={handleTrimDataChange}
                    currentVideoTime={currentVideoTime}
                    videoDuration={videoDuration}
                  />
                </div>
              </div>
            )}

            {activeTab === 'edit' && !currentVideo && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="text-center py-12">
                  <Play className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">No video selected</h3>
                  <p className="mt-1 text-base text-gray-700">
                    Record a new video or select one from your files to start editing.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Files</h2>
              <FileManager 
                videos={videos} 
                onVideoSelect={handleVideoSelect}
                onVideoDelete={handleVideoDelete}
                currentVideo={currentVideo}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 