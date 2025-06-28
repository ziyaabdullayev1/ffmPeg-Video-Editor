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
  let outputPath1 = ''
  let outputPath2 = ''
  
  try {
    const formData = await request.formData()
    const file = formData.get('video') as File
    const splitTime = formData.get('splitTime') as string

    if (!file || !splitTime) {
      return NextResponse.json({ error: 'Video file and split time required' }, { status: 400 })
    }

    const tempDir = tmpdir()
    const timestamp = Date.now()
    const fileExtension = file.type.includes('webm') ? 'webm' : 
                         file.type.includes('mp4') ? 'mp4' : 'mp4'
    
    inputPath = join(tempDir, `input_${timestamp}.${fileExtension}`)
    outputPath1 = join(tempDir, `part1_${timestamp}.mp4`)
    outputPath2 = join(tempDir, `part2_${timestamp}.mp4`)

    const bytes = await file.arrayBuffer()
    await writeFile(inputPath, Buffer.from(bytes))

    // Create first part (start to split time)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(0)
        .setDuration(parseFloat(splitTime))
        .output(outputPath1)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p'])
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    // Create second part (split time to end)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(parseFloat(splitTime))
        .output(outputPath2)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p'])
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    const buffer1 = await readFile(outputPath1)
    const buffer2 = await readFile(outputPath2)
    
    // Cleanup
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath1).catch(() => {}),
      unlink(outputPath2).catch(() => {})
    ])

    const originalName = file.name.replace(/\.[^/.]+$/, '')
    return NextResponse.json({
      part1: {
        data: Buffer.from(buffer1).toString('base64'),
        filename: `${originalName}_part1.mp4`,
        size: buffer1.length
      },
      part2: {
        data: Buffer.from(buffer2).toString('base64'),
        filename: `${originalName}_part2.mp4`,
        size: buffer2.length
      }
    })

  } catch (error) {
    // Cleanup on error
    await Promise.all([
      inputPath && unlink(inputPath).catch(() => {}),
      outputPath1 && unlink(outputPath1).catch(() => {}),
      outputPath2 && unlink(outputPath2).catch(() => {})
    ])
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to split video', details: errorMessage }, { status: 500 })
  }
} 