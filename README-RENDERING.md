# Real Video Rendering for React Video Editor

This documentation explains how to use the new FFmpeg-based rendering system for high-quality video exports.

## Overview

The rendering system uses a local Express server with FFmpeg to provide high-performance video rendering capabilities. This approach offers:

- Support for Full HD (1080p) and 4K (2160p) rendering
- Hardware acceleration detection (NVIDIA, Intel QuickSync, Apple VideoToolbox)
- Memory-efficient processing optimized for systems with limited resources
- Real-time progress updates via WebSockets
- System-specific optimizations for different hardware configurations

## Requirements

- Node.js 14+
- FFmpeg installed and available in PATH
- Browser with WebSocket support

## Getting Started

1. **Start the Rendering Server**

```bash
# Make the script executable (if not already)
chmod +x start-render-server.sh

# Start the server
./start-render-server.sh
```

The server will start on port 3031 by default.

2. **Use the Video Editor**

- Open the React Video Editor application
- Create your video project
- Click "Export" to open the rendering dialog
- Select your desired quality settings
- Click "Start Rendering"

## Architecture

The rendering process follows these steps:

1. **Client-side**:
   - User selects quality settings
   - Design data is sent to the server
   - Real-time progress updates are received via WebSocket

2. **Server-side**:
   - System capabilities are detected
   - Frames are extracted from the Remotion composition
   - FFmpeg encodes the video with optimal settings
   - The final video is made available for download

## Optimization Features

### Memory Efficiency

- Frames are processed in small batches to manage memory usage
- Garbage collection is triggered when memory pressure is high
- Temporary files are cleaned up after rendering

### Hardware Acceleration

The system automatically detects and uses available hardware acceleration:

- **Apple Silicon (M1/M2)**: Uses VideoToolbox for H.264 encoding
- **NVIDIA GPUs**: Uses NVENC for hardware-accelerated encoding
- **Intel CPUs**: Uses QuickSync for hardware-accelerated encoding
- **Any CPU**: Falls back to optimized software encoding

### Quality Settings

- **Full HD (1080p)**: Standard high-definition format (1920x1080)
- **4K (2160p)**: Ultra HD for maximum quality (3840x2160)

## Troubleshooting

### Server Won't Start

- Ensure Node.js is installed
- Verify that FFmpeg is installed and in your PATH
- Check server logs for specific errors

### Rendering Fails

- Check that the server is running
- Ensure your system has enough disk space
- For 4K rendering, ensure you have sufficient RAM (8GB minimum, 16GB recommended)

### Poor Performance

- Try a lower resolution for faster rendering
- Close other memory-intensive applications
- For longer videos, consider rendering in segments

## Future Improvements

- Add more quality presets
- Implement video filters and effects
- Add multi-pass encoding options for better quality
- Support for more output formats (WebM, GIF, etc.)