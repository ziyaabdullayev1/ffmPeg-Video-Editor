import ffmpeg from 'fluent-ffmpeg'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

let isConfigured = false

export function configureFfmpeg() {
  if (isConfigured) return
  
  if (os.platform() === 'win32') {
    // Try common installation paths for Windows
    const commonPaths = [
      // WinGet installation path
      join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-7.1.1-full_build', 'bin', 'ffmpeg.exe'),
      // Manual installation paths
      'C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe',
      'C:\\FFmpeg\\bin\\ffmpeg.exe',
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      // Chocolatey path
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
      // Default PATH (try without explicit path)
      'ffmpeg'
    ]
    
    for (const path of commonPaths) {
      try {
        if (path === 'ffmpeg' || existsSync(path)) {
          ffmpeg.setFfmpegPath(path)
          console.log('FFmpeg configured with path:', path)
          isConfigured = true
          return
        }
      } catch (error) {
        console.log(`Failed to set FFmpeg path ${path}:`, error)
        continue
      }
    }
    
    console.warn('FFmpeg not found in common paths. Please ensure FFmpeg is installed and in PATH.')
  } else {
    // For Linux/Mac, assume it's in PATH
    try {
      ffmpeg.setFfmpegPath('ffmpeg')
      isConfigured = true
      console.log('FFmpeg configured for Unix-like system')
    } catch (error) {
      console.error('Failed to configure FFmpeg:', error)
    }
  }
}

export function testFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg()
      .input('test')
      .on('error', () => resolve(false))
      .on('start', () => {
        resolve(true)
        // Kill the test process immediately
      })
      .format('null')
      .output('-')
      .run()
  })
} 