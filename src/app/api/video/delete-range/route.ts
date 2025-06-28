import { NextRequest, NextResponse } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import { writeFile, unlink, readFile, access, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { configureFfmpeg } from '@/lib/ffmpeg-config'

configureFfmpeg()

export async function POST(request: NextRequest) {
  let inputPath = ''
  let part1Path = ''
  let part2Path = ''
  let outputPath = ''
  
  try {
    const formData = await request.formData()
    const file = formData.get('video') as File
    const deleteStart = formData.get('deleteStart') as string
    const deleteEnd = formData.get('deleteEnd') as string

    if (!file || !deleteStart || !deleteEnd) {
      return NextResponse.json({ error: 'Video file, delete start, and delete end required' }, { status: 400 })
    }

    const deleteStartTime = parseFloat(deleteStart)
    const deleteEndTime = parseFloat(deleteEnd)

    if (deleteStartTime >= deleteEndTime) {
      return NextResponse.json({ error: 'Delete start must be less than delete end' }, { status: 400 })
    }

    const tempDir = tmpdir()
    const timestamp = Date.now()
    const fileExtension = file.type.includes('webm') ? 'webm' : 
                         file.type.includes('mp4') ? 'mp4' : 'mp4'
    
    inputPath = join(tempDir, `input_${timestamp}.${fileExtension}`)
    part1Path = join(tempDir, `part1_${timestamp}.mp4`)
    part2Path = join(tempDir, `part2_${timestamp}.mp4`)
    outputPath = join(tempDir, `output_${timestamp}.mp4`)

    const bytes = await file.arrayBuffer()
    await writeFile(inputPath, Buffer.from(bytes))

    // Get video duration - try multiple methods for WebM compatibility
    let videoDuration: number = 0
    
    try {
      // Method 1: Try FFprobe first
      console.log('Attempting to get duration via FFprobe...')
      videoDuration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            console.error('FFprobe failed:', err)
            reject(err)
          } else {
            console.log('FFprobe metadata format:', metadata.format)
            console.log('FFprobe streams[0]:', metadata.streams?.[0])
            
            // Try multiple sources for duration
            const formatDuration = metadata.format?.duration
            const streamDuration = metadata.streams?.[0]?.duration
            const streamTags = metadata.streams?.[0]?.tags?.DURATION
            const formatTags = metadata.format?.tags?.DURATION
            
            console.log('Duration sources:', {
              formatDuration,
              streamDuration, 
              streamTags,
              formatTags
            })
            
            let finalDuration = formatDuration || streamDuration
            
            // Parse tag duration if available (format: HH:MM:SS.mmm)
            if (!finalDuration && (streamTags || formatTags)) {
              const tagDuration = streamTags || formatTags
              const timeParts = tagDuration.split(':')
              if (timeParts.length === 3) {
                const hours = parseFloat(timeParts[0]) || 0
                const minutes = parseFloat(timeParts[1]) || 0
                const seconds = parseFloat(timeParts[2]) || 0
                finalDuration = hours * 3600 + minutes * 60 + seconds
              }
            }
            
            if (finalDuration && !isNaN(Number(finalDuration)) && Number(finalDuration) > 0) {
              console.log('FFprobe detected duration:', finalDuration, 'seconds')
              resolve(Number(finalDuration))
            } else {
              reject(new Error('No valid duration found in FFprobe metadata'))
            }
          }
        })
      })
    } catch (probeError) {
      console.log('FFprobe method failed, trying FFmpeg processing method...')
      
      // Method 2: Process the entire video to get duration
      try {
        videoDuration = await new Promise<number>((resolve, reject) => {
          let lastTime = 0
          
          ffmpeg(inputPath)
            .on('progress', (progress) => {
              if (progress.timemark) {
                // Parse timemark like "00:00:10.50"
                const timeParts = progress.timemark.split(':')
                if (timeParts.length === 3) {
                  const hours = parseFloat(timeParts[0]) || 0
                  const minutes = parseFloat(timeParts[1]) || 0
                  const seconds = parseFloat(timeParts[2]) || 0
                  lastTime = hours * 3600 + minutes * 60 + seconds
                }
              }
            })
            .on('end', () => {
              if (lastTime > 0) {
                console.log('FFmpeg processing detected duration:', lastTime, 'seconds')
                resolve(lastTime)
              } else {
                reject(new Error('Could not determine duration from processing'))
              }
            })
            .on('error', (err) => {
              console.error('FFmpeg processing error:', err)
              reject(err)
            })
            .format('null')
            .output(process.platform === 'win32' ? 'NUL' : '/dev/null')
            .run()
        })
      } catch (processError) {
        console.error('All duration detection methods failed')
        throw new Error('Could not determine video duration using any available method')
      }
    }

    // If delete range covers the entire video, return error
    if (deleteStartTime <= 0 && deleteEndTime >= videoDuration) {
      return NextResponse.json({ error: 'Cannot delete entire video' }, { status: 400 })
    }

    const hasPart1 = deleteStartTime > 0
    const hasPart2 = deleteEndTime < videoDuration

    console.log(`Video duration: ${videoDuration}s`)
    console.log(`Delete range: ${deleteStartTime}s - ${deleteEndTime}s`)
    console.log(`hasPart1: ${hasPart1}, hasPart2: ${hasPart2}`)

    // Create part 1 (from start to deleteStart) if needed
    if (hasPart1) {
      console.log(`Creating part 1: 0s - ${deleteStartTime}s`)
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(0)
          .setDuration(deleteStartTime)
          .output(part1Path)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p'])
          .on('start', (commandLine) => {
            console.log('Part 1 FFmpeg command:', commandLine)
          })
          .on('end', () => {
            console.log('Part 1 created successfully')
            resolve()
          })
          .on('error', (err) => {
            console.error('Part 1 creation error:', err)
            reject(err)
          })
          .run()
      })
    }

    // Create part 2 (from deleteEnd to end) if needed
    if (hasPart2) {
      console.log(`Creating part 2: ${deleteEndTime}s - ${videoDuration}s`)
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(deleteEndTime)
          .output(part2Path)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p'])
          .on('start', (commandLine) => {
            console.log('Part 2 FFmpeg command:', commandLine)
          })
          .on('end', () => {
            console.log('Part 2 created successfully')
            resolve()
          })
          .on('error', (err) => {
            console.error('Part 2 creation error:', err)
            reject(err)
          })
          .run()
      })
    }

    // Verify that the parts were created successfully
    if (hasPart1) {
      try {
        const stats1 = await stat(part1Path)
        console.log(`Part 1 file size: ${stats1.size} bytes`)
      } catch (err) {
        console.error('Part 1 file not found or has issues:', err)
      }
    }

    if (hasPart2) {
      try {
        const stats2 = await stat(part2Path)
        console.log(`Part 2 file size: ${stats2.size} bytes`)
      } catch (err) {
        console.error('Part 2 file not found or has issues:', err)
      }
    }

    // If we have both parts, concatenate them using a different approach
    if (hasPart1 && hasPart2) {
      // First, let's create a concat list file for reliable concatenation
      const concatListPath = join(tempDir, `concat_${timestamp}.txt`)
      
      // Use absolute paths and proper escaping for Windows compatibility
      const escapedPart1 = part1Path.replace(/\\/g, '/')
      const escapedPart2 = part2Path.replace(/\\/g, '/')
      const concatList = `file '${escapedPart1}'\nfile '${escapedPart2}'`
      await writeFile(concatListPath, concatList)

      console.log(`Concatenating parts: ${part1Path} + ${part2Path}`)
      console.log(`Concat list content:\n${concatList}`)

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-movflags', 'faststart',
            '-pix_fmt', 'yuv420p'
          ])
          .on('start', (commandLine) => {
            console.log('FFmpeg concatenation command:', commandLine)
          })
          .on('progress', (progress) => {
            console.log('Concatenation progress:', progress.percent)
          })
          .on('end', () => {
            console.log('FFmpeg concatenation completed successfully')
            // Clean up concat file
            unlink(concatListPath).catch(() => {})
            resolve()
          })
          .on('error', (err) => {
            console.error('FFmpeg concatenation error:', err)
            unlink(concatListPath).catch(() => {})
            reject(err)
          })
          .run()
      })
    } else if (hasPart1) {
      // Only part 1 exists, copy it as output
      console.log('Only part 1 exists, copying as output')
      await new Promise<void>((resolve, reject) => {
        ffmpeg(part1Path)
          .output(outputPath)
          .videoCodec('copy')
          .audioCodec('copy')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
    } else if (hasPart2) {
      // Only part 2 exists, copy it as output
      console.log('Only part 2 exists, copying as output')
      await new Promise<void>((resolve, reject) => {
        ffmpeg(part2Path)
          .output(outputPath)
          .videoCodec('copy')
          .audioCodec('copy')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
    }

    const resultBuffer = await readFile(outputPath)
    
    // Cleanup temporary files
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      hasPart1 && unlink(part1Path).catch(() => {}),
      hasPart2 && unlink(part2Path).catch(() => {}),
      unlink(outputPath).catch(() => {})
    ].filter(Boolean))

    const originalName = file.name.replace(/\.[^/.]+$/, '')
    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': resultBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${originalName}_edited.mp4"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    // Cleanup on error
    await Promise.all([
      inputPath && unlink(inputPath).catch(() => {}),
      part1Path && unlink(part1Path).catch(() => {}),
      part2Path && unlink(part2Path).catch(() => {}),
      outputPath && unlink(outputPath).catch(() => {})
    ].filter(Boolean))
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to delete range from video', details: errorMessage }, { status: 500 })
  }
} 