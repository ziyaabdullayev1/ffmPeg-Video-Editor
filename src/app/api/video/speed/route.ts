import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { configureFfmpeg } from '@/lib/ffmpeg-config'

// Configure FFmpeg on module load
configureFfmpeg()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('video') as File
    const speedMultiplier = formData.get('speed') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const speed = parseFloat(speedMultiplier)
    if (speed <= 0 || speed > 10) {
      return NextResponse.json({ error: 'Invalid speed multiplier' }, { status: 400 })
    }

    // Create temporary file paths
    const tempDir = tmpdir()
    const inputPath = join(tempDir, `input_${Date.now()}.webm`)
    const outputPath = join(tempDir, `output_${Date.now()}.mp4`)

    // Write uploaded file to temporary location
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(inputPath, buffer)

    // Process video with FFmpeg
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')

      // Apply speed filter
      if (speed !== 1) {
        const videoFilter = `setpts=${1/speed}*PTS`
        const audioFilter = `atempo=${speed}`
        
        // For speeds outside atempo range (0.5-100), we need to chain filters
        if (speed < 0.5 || speed > 2) {
          // For very slow or very fast speeds, adjust video only to avoid audio issues
          command = command.videoFilters(videoFilter)
        } else {
          // For normal range, adjust both video and audio
          command = command
            .videoFilters(videoFilter)
            .audioFilters(audioFilter)
        }
      }

      command
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    // Read processed file
    const processedBuffer = await readFile(outputPath)

    // Clean up temporary files
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    // Return processed video
    return new NextResponse(processedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="speed_${speed}x_${file.name}"`
      }
    })

  } catch (error) {
    console.error('Error processing video:', error)
    return NextResponse.json(
      { error: 'Failed to process video: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
} 