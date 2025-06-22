'use client'

import { useState } from 'react'
import { Play, Download, Trash2, Clock, FileVideo } from 'lucide-react'

interface VideoFile {
  id: string
  name: string
  url: string
  duration: number
  size: number
  createdAt: Date
}

interface FileManagerProps {
  videos: VideoFile[]
  onVideoSelect: (video: VideoFile) => void
  onVideoDelete: (videoId: string) => void
  currentVideo: VideoFile | null
}

export default function FileManager({ videos, onVideoSelect, onVideoDelete, currentVideo }: FileManagerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const downloadVideo = (video: VideoFile, event: React.MouseEvent) => {
    event.stopPropagation()
    const link = document.createElement('a')
    link.href = video.url
    link.download = video.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const deleteVideo = (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setShowDeleteConfirm(videoId)
  }

  const confirmDelete = (video: VideoFile) => {
    // Call the parent component's delete handler
    onVideoDelete(video.id)
    setShowDeleteConfirm(null)
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <FileVideo className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-semibold text-gray-900">No videos</h3>
        <p className="mt-1 text-base text-gray-700">
          Record your first video to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {videos.map((video) => (
        <div
          key={video.id}
          onClick={() => onVideoSelect(video)}
          className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
            currentVideo?.id === video.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <FileVideo className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {video.name}
                </h4>
              </div>
              
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(video.createdAt)}</span>
                </div>
                <div>
                  Size: {formatFileSize(video.size)}
                </div>
              </div>
            </div>

            <div className="flex space-x-1 ml-2">
              <button
                onClick={(e) => downloadVideo(video, e)}
                className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => deleteVideo(video.id, e)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {currentVideo?.id === video.id && (
            <div className="absolute top-2 right-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
          )}
        </div>
      ))}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Video</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this video? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const video = videos.find(v => v.id === showDeleteConfirm)
                  if (video) confirmDelete(video)
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 