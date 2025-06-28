import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import os from 'os'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const extractStart = parseFloat(formData.get('extractStart') as string)
    const extractEnd = parseFloat(formData.get('extractEnd') as string)

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    if (isNaN(extractStart) || isNaN(extractEnd) || extractStart >= extractEnd) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 })
    }

    console.log(`📤 Extracting range from ${extractStart}s to ${extractEnd}s`)

    // Create temporary files
    const tempDir = os.tmpdir()
    const inputPath = path.join(tempDir, `input_${Date.now()}_${videoFile.name}`)
    const outputPath = path.join(tempDir, `extracted_${Date.now()}.webm`)

    // Write uploaded file to temp location
    const arrayBuffer = await videoFile.arrayBuffer()
    fs.writeFileSync(inputPath, Buffer.from(arrayBuffer))

    console.log(`📥 Input file saved: ${inputPath}`)
    console.log(`📤 Output file will be: ${outputPath}`)

    // Extract the specified range using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(extractStart)
        .duration(extractEnd - extractStart)
        .videoCodec('libvpx-vp9')
        .audioCodec('libopus')
        .format('webm')
        .outputOptions([
          '-crf 30',
          '-b:v 1M',
          '-b:a 128k'
        ])
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg command:', commandLine)
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Extraction progress: ${Math.round(progress.percent)}%`)
          }
        })
        .on('end', () => {
          console.log('✅ Range extraction completed')
          resolve()
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err)
          reject(err)
        })
        .save(outputPath)
    })

    // Read the extracted video
    const extractedBuffer = fs.readFileSync(outputPath)
    const base64Video = extractedBuffer.toString('base64')

    // Cleanup
    try {
      fs.unlinkSync(inputPath)
      fs.unlinkSync(outputPath)
      console.log('🧹 Cleanup completed')
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError)
    }

    const duration = extractEnd - extractStart
    const originalName = path.parse(videoFile.name).name

    return NextResponse.json({
      success: true,
      video: {
        name: `${originalName}_extracted_${extractStart}s-${extractEnd}s.webm`,
        data: base64Video,
        duration: duration,
        size: extractedBuffer.length
      }
    })

  } catch (error) {
    console.error('💥 Extract range error:', error)
    return NextResponse.json({ 
      error: 'Failed to extract range from video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 