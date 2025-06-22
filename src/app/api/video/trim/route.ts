import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import { writeFile, unlink, readFile, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { configureFfmpeg } from '@/lib/ffmpeg-config'

// Configure FFmpeg on module load
configureFfmpeg()

export async function POST(request: NextRequest) {
  let inputPath = ''
  let outputPath = ''
  
  try {
    const formData = await request.formData()
    const file = formData.get('video') as File
    const startTime = formData.get('startTime') as string
    const duration = formData.get('duration') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!startTime || !duration) {
      return NextResponse.json({ error: 'Start time and duration are required' }, { status: 400 })
    }

    console.log(`Processing trim: startTime=${startTime}, duration=${duration}, fileSize=${file.size}`)

    // Create temporary file paths with proper extensions
    const tempDir = tmpdir()
    const timestamp = Date.now()
    const fileExtension = file.type.includes('webm') ? 'webm' : 
                         file.type.includes('mp4') ? 'mp4' : 
                         file.type.includes('mov') ? 'mov' : 'mp4'
    
    inputPath = join(tempDir, `input_${timestamp}.${fileExtension}`)
    outputPath = join(tempDir, `output_${timestamp}.mp4`)

    // Write uploaded file to temporary location
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(inputPath, buffer)

    console.log(`Input file written: ${inputPath} (${buffer.length} bytes)`)

    // Verify input file exists
    try {
      await access(inputPath)
    } catch (error) {
      throw new Error('Failed to write input file')
    }

    // Process video with FFmpeg with improved settings
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .setStartTime(parseFloat(startTime))
        .setDuration(parseFloat(duration))
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        // Add browser-compatible settings
        .videoFilter('scale=trunc(iw/2)*2:trunc(ih/2)*2') // Ensure even dimensions
        .outputOptions([
          '-movflags', 'faststart', // Enable progressive download
          '-pix_fmt', 'yuv420p',    // Ensure compatibility
          '-profile:v', 'baseline', // H.264 baseline profile for maximum compatibility
          '-level', '3.0'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine)
        })
        .on('progress', (progress) => {
          console.log('Processing progress:', progress.percent)
        })
        .on('end', () => {
          console.log('FFmpeg processing completed')
          resolve()
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message)
          console.error('FFmpeg stderr:', stderr)
          reject(new Error(`FFmpeg processing failed: ${err.message}`))
        })

      command.run()
    })

    // Verify output file exists and has content
    try {
      await access(outputPath)
    } catch (error) {
      throw new Error('Output file was not created')
    }

    // Read processed file
    const processedBuffer = await readFile(outputPath)
    console.log(`Output file read: ${processedBuffer.length} bytes`)

    if (processedBuffer.length === 0) {
      throw new Error('Output file is empty')
    }

    // Clean up temporary files
    await unlink(inputPath).catch((err) => console.warn('Failed to delete input file:', err))
    await unlink(outputPath).catch((err) => console.warn('Failed to delete output file:', err))

    // Return processed video with proper headers
    return new NextResponse(processedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': processedBuffer.length.toString(),
        'Content-Disposition': `inline; filename="trimmed_${file.name.replace(/\.[^/.]+$/, '')}.mp4"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error processing video:', error)
    
    // Clean up temporary files on error
    if (inputPath) {
      await unlink(inputPath).catch(() => {})
    }
    if (outputPath) {
      await unlink(outputPath).catch(() => {})
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to process video', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 