'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Scissors, Zap, Download, CheckCircle, Loader2, SkipBack, SkipForward, Play, Pause } from 'lucide-react'

interface VideoFile {
  id: string
  name: string
  url: string
  duration: number
  size: number
  createdAt: Date
}

interface VideoEditControlsProps {
  video: VideoFile
  onVideoProcessed: (processedBlob: Blob, filename: string) => void
  setIsProcessing: (processing: boolean) => void
  trimStart?: number
  trimEnd?: number
  onTrimDataChange?: (start: number, end: number) => void
  currentVideoTime?: number
  videoDuration?: number
}

export default function VideoEditControls({ 
  video, 
  onVideoProcessed, 
  setIsProcessing,
  trimStart: externalTrimStart,
  trimEnd: externalTrimEnd,
  onTrimDataChange,
  currentVideoTime = 0,
  videoDuration: externalVideoDuration = 0
}: VideoEditControlsProps) {
  const [trimStart, setTrimStart] = useState(isFinite(externalTrimStart || 0) ? externalTrimStart || 0 : 0)
  const [trimEnd, setTrimEnd] = useState(isFinite(externalTrimEnd || 30) ? externalTrimEnd || 30 : 30)
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [isProcessingLocal, setIsProcessingLocal] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  
  // Use external video duration if available, otherwise fallback to loading it ourselves
  const videoDuration = externalVideoDuration > 0 ? externalVideoDuration : 0
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartValue, setDragStartValue] = useState(0)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false)
  
  const timelineRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Reset trim end when video duration changes to prevent invalid ranges
  useEffect(() => {
    if (videoDuration > 0 && trimEnd > videoDuration) {
      const newEnd = Math.min(videoDuration, 30)
      setTrimEnd(newEnd)
      onTrimDataChange?.(trimStart, newEnd)
    }
  }, [videoDuration, trimEnd, trimStart, onTrimDataChange])

  // Sync with external trim values
  useEffect(() => {
    if (externalTrimStart !== undefined && isFinite(externalTrimStart) && externalTrimStart !== trimStart) {
      setTrimStart(externalTrimStart)
    }
    if (externalTrimEnd !== undefined && isFinite(externalTrimEnd) && externalTrimEnd !== trimEnd) {
      setTrimEnd(externalTrimEnd)
    }
  }, [externalTrimStart, externalTrimEnd, trimStart, trimEnd])

  // Update current time from video player
  useEffect(() => {
    if (currentVideoTime !== undefined) {
      setCurrentTime(currentVideoTime)
    }
  }, [currentVideoTime])

  const downloadVideo = () => {
    const link = document.createElement('a')
    link.href = video.url
    link.download = video.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const processVideo = async (operation: 'trim' | 'speed') => {
    try {
      setIsProcessingLocal(true)
      setIsProcessing(true)

      // Convert video URL to blob for upload
      const response = await fetch(video.url)
      const videoBlob = await response.blob()

      // Create form data for upload
      const formData = new FormData()
      formData.append('video', videoBlob, video.name)

      let apiEndpoint = ''
      if (operation === 'trim') {
        formData.append('startTime', trimStart.toString())
        formData.append('duration', (trimEnd - trimStart).toString())
        apiEndpoint = '/api/video/trim'
      } else if (operation === 'speed') {
        formData.append('speed', speedMultiplier.toString())
        apiEndpoint = '/api/video/speed'
      }

      // Upload and process video
      const processResponse = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}))
        throw new Error(errorData.details || errorData.error || `Server error: ${processResponse.status}`)
      }

      // Get processed video
      const processedBlob = await processResponse.blob()
      
      // Validate the processed blob
      if (!processedBlob || processedBlob.size === 0) {
        throw new Error('Processed video is empty')
      }

      if (processedBlob.type !== 'video/mp4') {
        console.warn('Unexpected blob type:', processedBlob.type)
      }

      console.log('Processed video blob:', {
        size: processedBlob.size,
        type: processedBlob.type
      })

      const filename = operation === 'trim' 
        ? `trimmed_${video.name.replace(/\.[^/.]+$/, '')}.mp4`
        : `speed_${speedMultiplier}x_${video.name.replace(/\.[^/.]+$/, '')}.mp4`

      onVideoProcessed(processedBlob, filename)

    } catch (error) {
      console.error('Error processing video:', error)
      alert('Error processing video. Please try again.')
    } finally {
      setIsProcessingLocal(false)   
      setIsProcessing(false)
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return '0:00.00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    const milliseconds = Math.floor((time % 1) * 100)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`
  }

  // Generate video thumbnails for timeline
  const generateThumbnails = useCallback(async () => {
    if (!video.url || videoDuration <= 0 || thumbnailsLoading) {
      console.log('Skipping thumbnail generation:', { url: video.url, duration: videoDuration, loading: thumbnailsLoading })
      return
    }
    
    console.log('Starting thumbnail generation for:', video.url, 'duration:', videoDuration)
    setThumbnailsLoading(true)
    const thumbnailCount = 20 // Number of thumbnails to generate
    const newThumbnails: string[] = []
    
    try {
      // Create a hidden video element for thumbnail generation
      const videoElement = document.createElement('video')
      videoElement.src = video.url
      // Remove crossOrigin to avoid CORS issues with local files
      videoElement.preload = 'metadata'
      videoElement.muted = true // Ensure it can play without user interaction
      
      console.log('Waiting for video metadata to load...')
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video metadata loading timeout'))
        }, 10000) // 10 second timeout
        
        videoElement.onloadedmetadata = () => {
          clearTimeout(timeout)
          console.log('Video metadata loaded:', {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            duration: videoElement.duration
          })
          resolve(void 0)
        }
        videoElement.onerror = (e) => {
          clearTimeout(timeout)
          reject(e)
        }
      })
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.error('Could not get canvas context')
        return
      }
      
      // Set canvas size to match video aspect ratio but smaller for thumbnails
      const aspectRatio = videoElement.videoWidth / videoElement.videoHeight
      canvas.width = 100 // Slightly larger thumbnails
      canvas.height = canvas.width / aspectRatio
      
      console.log('Generating', thumbnailCount, 'thumbnails...')
      for (let i = 0; i < thumbnailCount; i++) {
        const time = (i / (thumbnailCount - 1)) * videoDuration
        
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('Thumbnail generation timeout for time:', time)
            resolve(void 0)
          }, 2000) // 2 second timeout per thumbnail
          
          videoElement.currentTime = time
          videoElement.onseeked = () => {
            clearTimeout(timeout)
            try {
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8)
              newThumbnails.push(thumbnailUrl)
              console.log(`Generated thumbnail ${i + 1}/${thumbnailCount} at time ${time.toFixed(2)}s`)
            } catch (error) {
              console.error('Error drawing thumbnail:', error)
            }
            resolve(void 0)
          }
        })
      }
      
      console.log('Thumbnail generation complete:', newThumbnails.length, 'thumbnails generated')
      console.log('First thumbnail sample:', newThumbnails[0]?.substring(0, 50) + '...')
      setThumbnails(newThumbnails)
    } catch (error) {
      console.error('Error generating thumbnails:', error)
    } finally {
      setThumbnailsLoading(false)
    }
  }, [video.url, videoDuration, thumbnailsLoading])

  // Reset thumbnails when video changes
  useEffect(() => {
    setThumbnails([])
    setThumbnailsLoading(false)
  }, [video.url])

  // Generate thumbnails when video changes
  useEffect(() => {
    if (videoDuration > 0 && thumbnails.length === 0 && !thumbnailsLoading) {
      generateThumbnails()
    }
  }, [videoDuration, thumbnails.length, thumbnailsLoading, generateThumbnails])

  // Calculate safe values
  const safeTrimStart = isFinite(trimStart) ? trimStart : 0
  const safeTrimEnd = isFinite(trimEnd) ? trimEnd : 30
  const safeVideoDuration = isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 100
  const safeCurrentTime = isFinite(currentTime) ? currentTime : 0
  
  // Timeline interaction handlers
  const getTimeFromPosition = useCallback((clientX: number) => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return percentage * safeVideoDuration
  }, [safeVideoDuration])

  const handleTimelineClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return // Don't handle clicks while dragging
    
    const clickedTime = getTimeFromPosition(event.clientX)
    setCurrentTime(clickedTime)
  }, [isDragging, getTimeFromPosition])

  const handleMouseDown = useCallback((type: 'start' | 'end') => (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    setIsDragging(type)
    setDragStartX(event.clientX)
    setDragStartValue(type === 'start' ? safeTrimStart : safeTrimEnd)
    
    // Add global mouse event listeners
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - event.clientX
      const deltaTime = (deltaX / (timelineRef.current?.getBoundingClientRect().width || 1)) * safeVideoDuration
      
             if (type === 'start') {
         const newStart = Math.max(0, Math.min(safeTrimStart + deltaTime, safeTrimEnd - 0.1))
         setTrimStart(newStart)
         onTrimDataChange?.(newStart, safeTrimEnd)
       } else {
         const newEnd = Math.min(safeVideoDuration, Math.max(safeTrimEnd + deltaTime, safeTrimStart + 0.1))
         setTrimEnd(newEnd)
         onTrimDataChange?.(safeTrimStart, newEnd)
       }
    }
    
    const handleMouseUp = () => {
      setIsDragging(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [safeTrimStart, safeTrimEnd, safeVideoDuration])

  const adjustTrimTime = (type: 'start' | 'end', delta: number) => {
    if (type === 'start') {
      const currentStart = isFinite(trimStart) ? trimStart : 0
      const currentEnd = isFinite(trimEnd) ? trimEnd : 30
      const newStart = Math.max(0, Math.min(currentStart + delta, currentEnd - 0.1))
      setTrimStart(newStart)
      onTrimDataChange?.(newStart, currentEnd)
    } else {
      const currentStart = isFinite(trimStart) ? trimStart : 0
      const currentEnd = isFinite(trimEnd) ? trimEnd : 30
      const maxDuration = isFinite(videoDuration) ? videoDuration : 999999
      const newEnd = Math.min(maxDuration, Math.max(currentEnd + delta, currentStart + 0.1))
      setTrimEnd(newEnd)
      onTrimDataChange?.(currentStart, newEnd)
    }
  }



  // Calculate percentages for timeline visualization
  const startPercentage = (safeTrimStart / safeVideoDuration) * 100
  const endPercentage = (safeTrimEnd / safeVideoDuration) * 100
  const currentTimePercentage = (safeCurrentTime / safeVideoDuration) * 100

  return (
    <div className="space-y-6">
      {/* FFmpeg Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">FFmpeg Ready</h3>
            <p className="text-sm text-green-600 mt-1">
              Server-side video processing is ready. Your videos will be processed securely and efficiently.
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Trim Controls */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-gray-900">
          <Scissors className="w-5 h-5 text-blue-600" />
          <span>Professional Video Trimmer</span>
        </h3>
        
        <div className="space-y-6">
          {/* Video Duration Info */}
          {videoDuration > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-800 font-medium">
                  Video Duration: {formatTime(safeVideoDuration)}
                </span>
                <span className="text-blue-600">
                  Trim Duration: {formatTime(safeTrimEnd - safeTrimStart)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs mt-2">
                <span className="text-blue-600">
                  Thumbnails: {thumbnails.length > 0 ? `${thumbnails.length} loaded` : thumbnailsLoading ? 'Loading...' : 'Not loaded'}
                  {thumbnails.length > 0 && (
                    <span className="ml-2 text-green-600">✓ Ready to display</span>
                  )}
                </span>
                {thumbnails.length === 0 && !thumbnailsLoading && (
                  <button
                    onClick={() => {
                      setThumbnails([])
                      generateThumbnails()
                    }}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Generate Thumbnails
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Professional Visual Timeline */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-800">
              Interactive Timeline Editor
            </label>
            
            {/* Timeline Container */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <div 
                ref={timelineRef}
                className="relative h-20 bg-gray-900 rounded-lg cursor-pointer overflow-hidden border border-gray-300"
                onClick={handleTimelineClick}
                style={{ userSelect: 'none' }}
              >
                {/* Video thumbnail background */}
                {thumbnails.length > 0 ? (
                  <div className="absolute inset-0 flex" style={{ zIndex: 1 }}>
                    {thumbnails.map((thumbnail, index) => (
                      <div
                        key={index}
                        className="flex-1 h-full border-r border-gray-700"
                        style={{
                          backgroundImage: `url("${thumbnail}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                          minWidth: '5%'
                        }}
                        title={`Frame at ${((index / 19) * videoDuration).toFixed(1)}s`}
                      />
                    ))}
                  </div>
                ) : (
                  /* Fallback pattern while thumbnails load */
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800">
                    <div className="absolute inset-0 opacity-20">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-gray-400"
                          style={{ left: `${(i + 1) * 10}%` }}
                        />
                      ))}
                    </div>
                    {thumbnailsLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                          Loading thumbnails...
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Untrimmed sections (darkened overlay) */}
                {startPercentage > 0 && (
                  <div 
                    className="absolute top-0 bottom-0 bg-black bg-opacity-50 border-r-2 border-red-400"
                    style={{ left: '0%', width: `${startPercentage}%`, zIndex: 2 }}
                  />
                )}
                {endPercentage < 100 && (
                  <div 
                    className="absolute top-0 bottom-0 bg-black bg-opacity-50 border-l-2 border-red-400"
                    style={{ left: `${endPercentage}%`, width: `${100 - endPercentage}%`, zIndex: 2 }}
                  />
                )}
                
                {/* Active trim section highlight - very subtle */}
                <div 
                  className="absolute top-0 bottom-0 border-t-2 border-b-2 border-blue-400"
                  style={{
                    left: `${startPercentage}%`,
                    width: `${endPercentage - startPercentage}%`,
                    zIndex: 2,
                    pointerEvents: 'none' // Allow clicks to pass through
                  }}
                />
                
                {/* Start handle */}
                <div 
                  className={`absolute top-0 bottom-0 w-4 bg-blue-600 cursor-ew-resize hover:bg-blue-700 transition-colors flex items-center justify-center shadow-lg ${isDragging === 'start' ? 'bg-blue-800 scale-110' : ''}`}
                  style={{ left: `${startPercentage}%`, marginLeft: '-8px', zIndex: 10 }}
                  onMouseDown={handleMouseDown('start')}
                >
                  <div className="w-1 h-8 bg-white rounded-full shadow"></div>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {formatTime(safeTrimStart)}
                  </div>
                </div>
                
                {/* End handle */}
                <div 
                  className={`absolute top-0 bottom-0 w-4 bg-blue-600 cursor-ew-resize hover:bg-blue-700 transition-colors flex items-center justify-center shadow-lg ${isDragging === 'end' ? 'bg-blue-800 scale-110' : ''}`}
                  style={{ left: `${endPercentage}%`, marginLeft: '-8px', zIndex: 10 }}
                  onMouseDown={handleMouseDown('end')}
                >
                  <div className="w-1 h-8 bg-white rounded-full shadow"></div>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {formatTime(safeTrimEnd)}
                  </div>
                </div>
                
                {/* Current time playhead */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-red-500 shadow-lg"
                  style={{ left: `${currentTimePercentage}%`, zIndex: 8 }}
                >
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow"></div>
                </div>
                
                {/* Time markers */}
                <div className="absolute bottom-1 left-2 text-xs text-white font-mono bg-black bg-opacity-75 px-2 py-1 rounded shadow" style={{ zIndex: 4, pointerEvents: 'none' }}>
                  0:00
                </div>
                <div className="absolute bottom-1 right-2 text-xs text-white font-mono bg-black bg-opacity-75 px-2 py-1 rounded shadow" style={{ zIndex: 4, pointerEvents: 'none' }}>
                  {formatTime(safeVideoDuration)}
                </div>
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-white font-mono bg-black bg-opacity-75 px-2 py-1 rounded shadow" style={{ zIndex: 4, pointerEvents: 'none' }}>
                  {formatTime(safeVideoDuration / 2)}
                </div>
              </div>
            </div>
            
            {/* Timeline instructions */}
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>How to use:</strong> Drag the blue handles to set trim points. Click anywhere on the timeline to preview that moment. The red line shows current playback position.
              </p>
            </div>
          </div>

          {/* Precise Time Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Start Time
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  max={isFinite(videoDuration) ? videoDuration : undefined}
                  step="0.01"
                  value={isFinite(trimStart) ? Number(trimStart.toFixed(2)) : 0}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (isFinite(value)) {
                      const currentEnd = isFinite(trimEnd) ? trimEnd : 30
                      const newStart = Math.max(0, Math.min(value, currentEnd - 0.1))
                      setTrimStart(newStart)
                      onTrimDataChange?.(newStart, currentEnd)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900 bg-white"
                  disabled={isProcessingLocal}
                />
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => adjustTrimTime('start', -0.1)}
                    className="p-1 text-gray-600 hover:text-gray-800 border rounded"
                    disabled={isProcessingLocal}
                  >
                    <SkipBack className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => adjustTrimTime('start', 0.1)}
                    className="p-1 text-gray-600 hover:text-gray-800 border rounded"
                    disabled={isProcessingLocal}
                  >
                    <SkipForward className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {formatTime(isFinite(trimStart) ? trimStart : 0)}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                End Time
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={isFinite(trimStart) ? trimStart + 0.1 : 0.1}
                  max={isFinite(videoDuration) ? videoDuration : undefined}
                  step="0.01"
                  value={isFinite(trimEnd) ? Number(trimEnd.toFixed(2)) : 30}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (isFinite(value)) {
                      const maxValue = isFinite(videoDuration) ? videoDuration : 999999
                      const currentStart = isFinite(trimStart) ? trimStart : 0
                      const minValue = currentStart + 0.1
                      const newEnd = Math.min(maxValue, Math.max(value, minValue))
                      setTrimEnd(newEnd)
                      onTrimDataChange?.(currentStart, newEnd)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900 bg-white"
                  disabled={isProcessingLocal}
                />
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => adjustTrimTime('end', -0.1)}
                    className="p-1 text-gray-600 hover:text-gray-800 border rounded"
                    disabled={isProcessingLocal}
                  >
                    <SkipBack className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => adjustTrimTime('end', 0.1)}
                    className="p-1 text-gray-600 hover:text-gray-800 border rounded"
                    disabled={isProcessingLocal}
                  >
                    <SkipForward className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {formatTime(isFinite(trimEnd) ? trimEnd : 30)}
              </div>
            </div>
          </div>



          {/* Reset and Process Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setTrimStart(0)
                const maxDuration = isFinite(videoDuration) ? videoDuration : 999999
                const newEnd = Math.min(30, maxDuration)
                setTrimEnd(newEnd)
                onTrimDataChange?.(0, newEnd)
              }}
              disabled={isProcessingLocal}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => processVideo('trim')}
              disabled={isProcessingLocal || trimEnd <= trimStart}
              className="flex-2 flex items-center justify-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessingLocal ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Scissors className="w-5 h-5" />
              )}
              <span>{isProcessingLocal ? 'Processing...' : 'Trim Video'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Speed Controls */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-gray-900">
          <Zap className="w-5 h-5 text-green-600" />
          <span>Change Speed</span>
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Speed Multiplier: {speedMultiplier}x
            </label>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.25"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isProcessingLocal}
            />
            <div className="flex justify-between text-xs text-gray-700 font-medium mt-1">
              <span>0.25x</span>
              <span>1x</span>
              <span>4x</span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {[0.5, 1, 1.5, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeedMultiplier(speed)}
                disabled={isProcessingLocal}
                className={`px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                  speedMultiplier === speed
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
          
          <button
            onClick={() => processVideo('speed')}
            disabled={isProcessingLocal || speedMultiplier === 1}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessingLocal ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            <span>{isProcessingLocal ? 'Processing...' : 'Change Speed'}</span>
          </button>
        </div>
      </div>

      {/* Download */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2 text-gray-900">
          <Download className="w-5 h-5 text-indigo-600" />
          <span>Download Video</span>
        </h3>
        <button
          onClick={downloadVideo}
          disabled={isProcessingLocal}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-5 h-5" />
          <span>Download Video</span>
        </button>
      </div>

      {/* Processing Info */}
      {isProcessingLocal && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Processing Video</h3>
              <p className="text-sm text-blue-600">
                Your video is being processed on the server. This may take a few moments...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 