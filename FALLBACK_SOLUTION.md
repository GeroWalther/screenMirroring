# Android TV Screen Sharing - Alternative Solutions

## Current Issue
React Native WebRTC on Android TV cannot decode video streams properly, showing "NOT IMPLEMENTED" errors.

## Alternative Approaches

### Option 1: HTTP Stream Server (Recommended)
Instead of WebRTC, create an HTTP video stream server on Mac and view it via Android TV browser.

### Option 2: Simple WebSocket + Canvas Approach  
Send screenshot frames over WebSocket and render on HTML5 canvas.

### Option 3: Use Android TV Web Browser
Host a web page that receives WebRTC stream (web browsers have better WebRTC support).

### Option 4: RTMP/HTTP-HLS Streaming
Use traditional video streaming protocols that Android TV supports natively.

Let me implement Option 1 (HTTP Stream Server) which will work reliably on any Android TV.