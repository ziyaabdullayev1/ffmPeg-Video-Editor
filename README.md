# Video Editor - Record, Edit & Share

A modern web-based video editor built with Next.js, featuring video recording, playback, and editing capabilities powered by FFmpeg.

## Features

### 🎥 Video Recording
- **Webcam Integration**: Record videos directly from your webcam
- **Real-time Preview**: See yourself while recording
- **Audio Control**: Toggle audio recording on/off
- **Recording Timer**: Live timer showing recording duration
- **Multiple Formats**: Support for WebM and MP4 formats

### 📽️ Video Playback
- **Custom Video Player**: Professional video player with custom controls
- **Seeking**: Click progress bar to jump to any position
- **Volume Control**: Adjust volume or mute audio
- **Skip Controls**: 10-second forward/backward buttons
- **Responsive Design**: Works on desktop and mobile

### ✂️ Video Editing (FFmpeg Integration)
- **Video Trimming**: Cut videos to specific start and end times
- **Speed Control**: Change video speed from 0.25x to 4x
- **Real-time Processing**: See progress while FFmpeg processes videos
- **Batch Operations**: Process multiple videos

### 📁 File Management
- **Video Library**: View all recorded and edited videos
- **File Information**: See file size, creation date, and duration
- **Download**: Download videos to your device
- **Delete**: Remove unwanted videos with confirmation
- **Visual Selection**: Clear indication of currently selected video

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

### Recording Your First Video

1. Click the **"Record"** tab in the header
2. Click **"Start Camera"** to enable your webcam
3. Adjust audio settings using the microphone icon
4. Click **"Start Recording"** to begin
5. Click **"Stop Recording"** when finished
6. Your video will automatically appear in the edit tab

### Editing Videos

1. Select a video from the file manager or record a new one
2. Click the **"Edit"** tab
3. **Load FFmpeg** if not already loaded (first time only)
4. Use the editing controls:
   - **Trim**: Set start and end times to cut video
   - **Speed**: Adjust playback speed with slider or preset buttons
5. Click the respective processing button
6. Wait for processing to complete
7. The edited video will appear in your files

### Managing Files

1. Click the **"Files"** tab to see all videos
2. Click any video to select and view it
3. Use the download button to save videos locally
4. Use the delete button to remove unwanted videos

## Technical Features

### FFmpeg Integration
- **Browser-based**: Runs entirely in the browser using WebAssembly
- **No Server Required**: All processing happens client-side
- **Fast Processing**: Optimized for common video operations
- **Format Support**: Handles WebM, MP4, and other formats

### Modern UI/UX
- **Responsive Design**: Works on all screen sizes
- **Loading States**: Clear feedback during processing
- **Progress Indicators**: Real-time progress for long operations
- **Error Handling**: Graceful error messages and recovery

### Performance
- **Lazy Loading**: FFmpeg loads only when needed
- **Memory Management**: Automatic cleanup of processed files
- **Efficient Storage**: Uses browser's blob storage for videos

## Browser Compatibility

- **Chrome**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (may require HTTPS)
- **Edge**: ✅ Full support

## Requirements

- Modern web browser with WebRTC support
- Camera and microphone permissions for recording
- Sufficient storage space for video files
- Internet connection for initial FFmpeg download

## Development

### Project Structure
```
src/
├── app/
│   ├── page.tsx          # Main application page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
└── components/
    ├── VideoEditor.tsx       # Main container component
    ├── VideoRecorder.tsx     # Recording functionality
    ├── VideoPlayer.tsx       # Video playback
    ├── VideoEditControls.tsx # Editing controls
    └── FileManager.tsx       # File management
```

### Key Technologies
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety and better development experience
- **Tailwind CSS**: Utility-first CSS framework
- **FFmpeg.wasm**: Browser-based video processing
- **WebRTC**: Browser media capture APIs
- **Lucide React**: Modern icon library

### Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Customization

### Adding New Video Effects
1. Extend the `VideoEditControls` component
2. Add new FFmpeg commands in the `processVideo` function
3. Update the UI with new controls

### Changing Video Quality
Modify the `getUserMedia` constraints in `VideoRecorder.tsx`:
```javascript
video: { width: 1920, height: 1080 } // 1080p
video: { width: 1280, height: 720 }  // 720p (default)
video: { width: 640, height: 480 }   // 480p
```

### Customizing UI Theme
Update the Tailwind classes throughout the components or modify `globals.css` for global style changes.

## Troubleshooting

### Camera Not Working
- Check browser permissions for camera/microphone
- Ensure you're using HTTPS (required by some browsers)
- Try refreshing the page

### FFmpeg Loading Issues
- Check internet connection
- Clear browser cache
- Ensure browser supports WebAssembly

### Performance Issues
- Close other browser tabs
- Increase available system memory
- Use shorter video clips for editing

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
