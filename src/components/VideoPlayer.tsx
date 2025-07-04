'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Scissors, Trash2, Square, X, MinusCircle, Split, Zap, Target } from 'lucide-react'

interface VideoFile {
  id: string
  name: string
  url: string
  duration: number
  size: number
  createdAt: Date
}

interface VideoPlayerProps {
  video: VideoFile
  trimStart?: number
  trimEnd?: number
  onTimeUpdate?: (currentTime: number) => void
  onDurationChange?: (duration: number) => void
  showTrimMarkers?: boolean
  onSplit?: (splitTime: number) => void
  onDeleteRange?: (deleteStart: number, deleteEnd: number) => void
  onExtractRange?: (extractStart: number, extractEnd: number) => void
}

export default function VideoPlayer({ 
  video, 
  trimStart = 0, 
  trimEnd, 
  onTimeUpdate,
  onDurationChange,
  showTrimMarkers = false,
  onSplit,
  onDeleteRange,
  onExtractRange
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [deleteRangeStart, setDeleteRangeStart] = useState<number | null>(null)
  const [deleteRangeEnd, setDeleteRangeEnd] = useState<number | null>(null)
  const [isSelectingDeleteRange, setIsSelectingDeleteRange] = useState(false)
  const [extractRangeStart, setExtractRangeStart] = useState<number | null>(null)
  const [extractRangeEnd, setExtractRangeEnd] = useState<number | null>(null)
  const [isSelectingExtractRange, setIsSelectingExtractRange] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleTimeUpdate = () => {
      const time = videoElement.currentTime
      setCurrentTime(time)
      onTimeUpdate?.(time)
    }
    
    const handleDurationChange = () => {
      const newDuration = videoElement.duration
      console.log('VideoPlayer: Duration changed to', newDuration)
      setDuration(newDuration)
      if (isFinite(newDuration) && newDuration > 0) {
        onDurationChange?.(newDuration)
      }
    }
    
    const handleLoadedMetadata = () => {
      const newDuration = videoElement.duration
      console.log('VideoPlayer: Metadata loaded, duration:', newDuration)
      setDuration(newDuration)
      if (isFinite(newDuration) && newDuration > 0) {
        onDurationChange?.(newDuration)
      }
    }
    
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => setIsPlaying(false)
    
    const handleError = (e: Event) => {
      const error = (e.target as HTMLVideoElement).error
      console.error('Video error:', error)
    }

    videoElement.addEventListener('timeupdate', handleTimeUpdate)
    videoElement.addEventListener('durationchange', handleDurationChange)
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata)
    videoElement.addEventListener('play', handlePlay)
    videoElement.addEventListener('pause', handlePause)
    videoElement.addEventListener('ended', handleEnded)
    videoElement.addEventListener('error', handleError)

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate)
      videoElement.removeEventListener('durationchange', handleDurationChange)
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata)
      videoElement.removeEventListener('play', handlePlay)
      videoElement.removeEventListener('pause', handlePause)
      videoElement.removeEventListener('ended', handleEnded)
      videoElement.removeEventListener('error', handleError)
    }
  }, [video, onTimeUpdate, onDurationChange])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect()
      const clickX = Math.max(0, event.clientX - rect.left)
      
      if (rect.width > 0) {
        const percentage = Math.min(1, Math.max(0, clickX / rect.width))
        const newTime = percentage * duration
        
        // Ensure the new time is finite and within valid range
        if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
          if (isSelectingDeleteRange) {
            if (deleteRangeStart === null) {
              // First click during delete selection - set start point
              setDeleteRangeStart(newTime)
            } else {
              // Second click during delete selection - set end point
              setDeleteRangeEnd(newTime)
              setIsSelectingDeleteRange(false)
            }
          } else if (isSelectingExtractRange) {
            if (extractRangeStart === null) {
              // First click during extract selection - set start point
              setExtractRangeStart(newTime)
            } else {
              // Second click during extract selection - set end point
              setExtractRangeEnd(newTime)
              setIsSelectingExtractRange(false)
            }
          } else if (deleteRangeStart === null && onDeleteRange) {
            // If no range is selected and delete range is available, start selection
            setDeleteRangeStart(newTime)
            setIsSelectingDeleteRange(true)
          } else if (extractRangeStart === null && onExtractRange) {
            // If no extract range is selected and extract range is available, start selection
            setExtractRangeStart(newTime)
            setIsSelectingExtractRange(true)
          } else {
            // Normal seek behavior
            videoRef.current.currentTime = newTime
          }
        }
      } 
    }
  }

  const skip = (seconds: number) => {
    if (videoRef.current && duration > 0) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
      if (isFinite(newTime)) {
        videoRef.current.currentTime = newTime
      }
    }
  }

  const jumpToTrimStart = () => {
    if (videoRef.current && isFinite(trimStart)) {
      videoRef.current.currentTime = trimStart
    }
  }

  const jumpToTrimEnd = () => {
    if (videoRef.current && trimEnd && isFinite(trimEnd)) {
      videoRef.current.currentTime = trimEnd
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const handleSplit = () => {
    if (onSplit && isFinite(duration) && duration > 0) {
      const middlePoint = duration / 2
      onSplit(middlePoint)
    }
  }

  const startDeleteRangeSelection = () => {
    setIsSelectingDeleteRange(true)
    setDeleteRangeStart(currentTime)
    setDeleteRangeEnd(null)
  }

  const setDeleteRangeFromTimeline = (time: number) => {
    if (deleteRangeStart === null) {
      setDeleteRangeStart(time)
      setIsSelectingDeleteRange(true)
    } else if (isSelectingDeleteRange) {
      setDeleteRangeEnd(time)
      setIsSelectingDeleteRange(false)
    }
  }

  const clearDeleteRange = () => {
    setDeleteRangeStart(null)
    setDeleteRangeEnd(null)
    setIsSelectingDeleteRange(false)
  }

  const executeDeleteRange = () => {
    if (onDeleteRange && deleteRangeStart !== null && deleteRangeEnd !== null) {
      const start = Math.min(deleteRangeStart, deleteRangeEnd)
      const end = Math.max(deleteRangeStart, deleteRangeEnd)
      if (start < end && start >= 0 && end <= duration) {
        onDeleteRange(start, end)
        clearDeleteRange()
      }
    }
  }

  const clearExtractRange = () => {
    setExtractRangeStart(null)
    setExtractRangeEnd(null)
    setIsSelectingExtractRange(false)
  }

  const executeExtractRange = () => {
    if (onExtractRange && extractRangeStart !== null && extractRangeEnd !== null) {
      const start = Math.min(extractRangeStart, extractRangeEnd)
      const end = Math.max(extractRangeStart, extractRangeEnd)
      if (start < end && start >= 0 && end <= duration) {
        onExtractRange(start, end)
        clearExtractRange()
      }
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progressPercentage = duration > 0 && isFinite(currentTime) && isFinite(duration) 
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 0

  // Calculate trim marker positions
  const trimStartPercentage = duration > 0 && isFinite(trimStart) 
    ? Math.min(100, Math.max(0, (trimStart / duration) * 100))
    : 0
  
  const trimEndPercentage = duration > 0 && trimEnd && isFinite(trimEnd)
    ? Math.min(100, Math.max(0, (trimEnd / duration) * 100))
    : 100

  // Check if current time is within trim range
  const isInTrimRange = showTrimMarkers && 
    currentTime >= trimStart && 
    (trimEnd ? currentTime <= trimEnd : true)

  // Calculate delete range positions
  const deleteStartPercentage = duration > 0 && deleteRangeStart !== null
    ? Math.min(100, Math.max(0, (deleteRangeStart / duration) * 100))
    : 0
  
  const deleteEndPercentage = duration > 0 && deleteRangeEnd !== null
    ? Math.min(100, Math.max(0, (deleteRangeEnd / duration) * 100))
    : (isSelectingDeleteRange && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0)

  const hasValidDeleteRange = deleteRangeStart !== null && deleteRangeEnd !== null && 
    Math.abs(deleteRangeEnd - deleteRangeStart) > 0.1

  // Calculate extract range positions
  const extractStartPercentage = duration > 0 && extractRangeStart !== null
    ? Math.min(100, Math.max(0, (extractRangeStart / duration) * 100))
    : 0
  
  const extractEndPercentage = duration > 0 && extractRangeEnd !== null
    ? Math.min(100, Math.max(0, (extractRangeEnd / duration) * 100))
    : (isSelectingExtractRange && duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0)

  const hasValidExtractRange = extractRangeStart !== null && extractRangeEnd !== null && 
    Math.abs(extractRangeEnd - extractRangeStart) > 0.1

  return (
    <div className="space-y-4">
      {/* Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video group">
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain"
          onClick={togglePlay}
          controls={false}
          preload="metadata"
        />
        
        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={togglePlay}
            className="p-4 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
          </button>
        </div>

        {/* Video Info Overlay */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
          <span className="text-sm font-medium">{video.name}</span>
        </div>

        {/* Trim Range Indicator */}
        {showTrimMarkers && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded flex items-center space-x-2">
            <Scissors className="w-4 h-4" />
            <span className="text-sm">
              {isInTrimRange ? '✓ In Trim Range' : 'Outside Trim Range'}
            </span>
          </div>
        )}

        {/* Delete Range Mode Indicator */}
        {(isSelectingDeleteRange || hasValidDeleteRange) && (
          <div className="absolute top-4 right-4 bg-red-600 bg-opacity-90 text-white px-3 py-2 rounded-lg flex items-center space-x-2 border border-red-400">
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isSelectingDeleteRange && deleteRangeStart === null && 'Click to set start point'}
              {isSelectingDeleteRange && deleteRangeStart !== null && 'Click to set end point'}
              {hasValidDeleteRange && 'Range selected for deletion'}
            </span>
          </div>
        )}

        {/* Extract Range Mode Indicator */}
        {(isSelectingExtractRange || hasValidExtractRange) && (
          <div className="absolute top-4 right-4 bg-green-600 bg-opacity-90 text-white px-3 py-2 rounded-lg flex items-center space-x-2 border border-green-400">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">
              {isSelectingExtractRange && extractRangeStart === null && 'Click to set start point'}
              {isSelectingExtractRange && extractRangeStart !== null && 'Click to set end point'}
              {hasValidExtractRange && 'Range selected for extraction'}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="relative h-3 bg-gray-200 rounded-full cursor-pointer"
          >
            {/* Trim range highlight */}
            {showTrimMarkers && (
              <div
                className="absolute top-0 h-full bg-blue-200 rounded-full"
                style={{
                  left: `${trimStartPercentage}%`,
                  width: `${trimEndPercentage - trimStartPercentage}%`
                }}
              />
            )}

            {/* Delete range highlight */}
            {(deleteRangeStart !== null || isSelectingDeleteRange) && (
              <div
                className="absolute top-0 h-full bg-red-400 rounded-full opacity-80 border-2 border-red-600"
                style={{
                  left: `${Math.min(deleteStartPercentage, deleteEndPercentage)}%`,
                  width: `${Math.abs(deleteEndPercentage - deleteStartPercentage)}%`
                }}
              >
                {hasValidDeleteRange && (
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-full opacity-90 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">DELETE</span>
                  </div>
                )}
              </div>
            )}

            {/* Extract range highlight */}
            {(extractRangeStart !== null || isSelectingExtractRange) && (
              <div
                className="absolute top-0 h-full bg-green-400 rounded-full opacity-80 border-2 border-green-600"
                style={{
                  left: `${Math.min(extractStartPercentage, extractEndPercentage)}%`,
                  width: `${Math.abs(extractEndPercentage - extractStartPercentage)}%`
                }}
              >
                {hasValidExtractRange && (
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-green-600 rounded-full opacity-90 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">EXTRACT</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Progress bar */}
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                isInTrimRange ? 'bg-blue-500' : 'bg-gray-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
            
            {/* Trim markers */}
            {showTrimMarkers && (
              <>
                <div
                  className="absolute top-0 w-1 h-full bg-blue-600 rounded-full"
                  style={{ left: `${trimStartPercentage}%` }}
                />
                {trimEnd && (
                  <div
                    className="absolute top-0 w-1 h-full bg-blue-600 rounded-full"
                    style={{ left: `${trimEndPercentage}%` }}
                  />
                )}
              </>
            )}

            {/* Delete range markers */}
            {deleteRangeStart !== null && (
              <div
                className="absolute top-0 w-2 h-full bg-red-600 rounded-full shadow-lg"
                style={{ left: `${deleteStartPercentage}%`, marginLeft: '-1px' }}
              >
                <div className="absolute -top-2 -left-1 w-4 h-4 bg-red-600 rounded-full shadow-lg border-2 border-white"></div>
              </div>
            )}
            {deleteRangeEnd !== null && (
              <div
                className="absolute top-0 w-2 h-full bg-red-600 rounded-full shadow-lg"
                style={{ left: `${deleteEndPercentage}%`, marginLeft: '-1px' }}
              >
                <div className="absolute -top-2 -left-1 w-4 h-4 bg-red-600 rounded-full shadow-lg border-2 border-white"></div>
              </div>
            )}
            {isSelectingDeleteRange && deleteRangeStart !== null && (
              <div
                className="absolute top-0 w-2 h-full bg-red-400 rounded-full shadow-lg animate-pulse"
                style={{ left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%`, marginLeft: '-1px' }}
              >
                <div className="absolute -top-2 -left-1 w-4 h-4 bg-red-400 rounded-full shadow-lg border-2 border-white animate-pulse"></div>
              </div>
            )}

            {/* Extract range markers */}
            {extractRangeStart !== null && (
              <div
                className="absolute top-0 w-2 h-full bg-green-600 rounded-full shadow-lg"
                style={{ left: `${extractStartPercentage}%`, marginLeft: '-1px' }}
              >
                <div className="absolute -top-2 -left-1 w-4 h-4 bg-green-600 rounded-full shadow-lg border-2 border-white"></div>
              </div>
            )}
            {extractRangeEnd !== null && (
              <div
                className="absolute top-0 w-2 h-full bg-green-600 rounded-full shadow-lg"
                style={{ left: `${extractEndPercentage}%`, marginLeft: '-1px' }}
              >
                <div className="absolute -top-2 -left-1 w-4 h-4 bg-green-600 rounded-full shadow-lg border-2 border-white"></div>
              </div>
            )}
            {isSelectingExtractRange && extractRangeStart !== null && (
              <div
                className="absolute top-0 w-2 h-full bg-green-400 rounded-full shadow-lg animate-pulse"
                style={{ left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%`, marginLeft: '-1px' }}
              >
                <div className="absolute -top-2 -left-1 w-4 h-4 bg-green-400 rounded-full shadow-lg border-2 border-white animate-pulse"></div>
              </div>
            )}
            
            {/* Current time handle */}
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full shadow transition-all ${
                isInTrimRange ? 'bg-blue-500' : 'bg-gray-500'
              }`}
              style={{ left: `${progressPercentage}%`, marginLeft: '-8px' }}
            />
          </div>
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>{formatTime(currentTime)}</span>
            
            {/* Status messages for range selection */}
            <div className="flex-1 text-center">
              {isSelectingDeleteRange && deleteRangeStart === null && (
                <span className="text-red-600 font-medium animate-pulse">
                  🔴 Click timeline to set DELETE start point
                </span>
              )}
              {isSelectingDeleteRange && deleteRangeStart !== null && (
                <span className="text-red-600 font-medium animate-pulse">
                  🔴 Click timeline to set DELETE end point
                </span>
              )}
              {hasValidDeleteRange && (
                <span className="text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
                  ✂️ Delete: {formatTime(Math.min(deleteRangeStart!, deleteRangeEnd!))} - {formatTime(Math.max(deleteRangeStart!, deleteRangeEnd!))}
                </span>
              )}
              {isSelectingExtractRange && extractRangeStart === null && (
                <span className="text-green-600 font-medium animate-pulse">
                  🟢 Click timeline to set EXTRACT start point
                </span>
              )}
              {isSelectingExtractRange && extractRangeStart !== null && (
                <span className="text-green-600 font-medium animate-pulse">
                  🟢 Click timeline to set EXTRACT end point
                </span>
              )}
              {hasValidExtractRange && (
                <span className="text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                  📤 Extract: {formatTime(Math.min(extractRangeStart!, extractRangeEnd!))} - {formatTime(Math.max(extractRangeStart!, extractRangeEnd!))}
                </span>
              )}
              {!isSelectingDeleteRange && !isSelectingExtractRange && !hasValidDeleteRange && !hasValidExtractRange && onDeleteRange && onExtractRange && (
                <span className="text-gray-500 text-sm">
                  Click timeline: 🔴 Set delete range | 🟢 Set extract range
                </span>
              )}
            </div>
            
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="space-y-3">
          {/* Playback Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => skip(-10)}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                title="Skip back 10s"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={() => skip(10)}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                title="Skip forward 10s"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              {onSplit && (
                <button
                  onClick={handleSplit}
                  disabled={!duration || duration <= 0}
                  className="flex items-center space-x-1 px-3 py-2 text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md"
                  title="Split video into two equal parts"
                >
                  <Split className="w-4 h-4" />
                  <span className="text-sm font-medium">Split in Half</span>
                </button>
              )}
            </div>

            {/* Volume Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Video Editing Tools Section */}
          <div className="space-y-3 border-t pt-3">
            {/* Delete Range Controls */}
            {onDeleteRange && (
              <div className="flex items-center justify-center">
                {!isSelectingDeleteRange && !hasValidDeleteRange && (
                  <button
                    onClick={() => {
                      setIsSelectingDeleteRange(true)
                      setDeleteRangeStart(null)
                      setDeleteRangeEnd(null)
                    }}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg border border-gray-300"
                    title="Click timeline to select range for deletion"
                  >
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-medium">Select Range to Delete</span>
                  </button>
                )}
                {isSelectingDeleteRange && (
                  <button
                    onClick={clearDeleteRange}
                    className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors rounded-lg border border-red-300 animate-pulse"
                    title="Cancel selection"
                  >
                    <X className="w-4 h-4" />
                    <span className="text-sm font-medium">Cancel Selection</span>
                  </button>
                )}
                {hasValidDeleteRange && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={executeDeleteRange}
                      className="flex items-center space-x-2 px-4 py-2 text-white bg-red-500 hover:bg-red-600 transition-colors rounded-lg shadow-lg"
                      title="Delete selected range"
                    >
                      <MinusCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Delete Selected Range</span>
                    </button>
                    <button
                      onClick={clearDeleteRange}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-colors rounded-lg border border-gray-300"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">Clear</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Extract Range Controls */}
            {onExtractRange && (
              <div className="flex items-center justify-center">
                {!isSelectingExtractRange && !hasValidExtractRange && (
                  <button
                    onClick={() => {
                      setIsSelectingExtractRange(true)
                      setExtractRangeStart(null)
                      setExtractRangeEnd(null)
                    }}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors rounded-lg border border-gray-300"
                    title="Click timeline to select range for extraction"
                  >
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">Select Range to Extract</span>
                  </button>
                )}
                {isSelectingExtractRange && (
                  <button
                    onClick={clearExtractRange}
                    className="flex items-center space-x-2 px-4 py-2 text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors rounded-lg border border-green-300 animate-pulse"
                    title="Cancel selection"
                  >
                    <X className="w-4 h-4" />
                    <span className="text-sm font-medium">Cancel Selection</span>
                  </button>
                )}
                {hasValidExtractRange && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={executeExtractRange}
                      className="flex items-center space-x-2 px-4 py-2 text-white bg-green-500 hover:bg-green-600 transition-colors rounded-lg shadow-lg"
                      title="Extract selected range as new video"
                    >
                      <Zap className="w-4 h-4" />
                      <span className="text-sm font-medium">Extract Selected Range</span>
                    </button>
                    <button
                      onClick={clearExtractRange}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-colors rounded-lg border border-gray-300"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">Clear</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trim Navigation (when trim markers are shown) */}
        {showTrimMarkers && (
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <button
                onClick={jumpToTrimStart}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                title="Jump to trim start"
              >
                Start
              </button>
              {trimEnd && (
                <button
                  onClick={jumpToTrimEnd}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  title="Jump to trim end"
                >
                  End
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 