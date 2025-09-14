// Simple test to verify screen capture is working
const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  })

  win.loadURL(`data:text/html,
    <html>
      <body>
        <h1>Screen Capture Test</h1>
        <button onclick="testCapture()">Test Screen Capture</button>
        <video id="preview" width="400" height="300" autoplay muted></video>
        <div id="status"></div>
        <script>
          async function testCapture() {
            const status = document.getElementById('status');
            const video = document.getElementById('preview');
            
            try {
              status.innerHTML = 'Requesting screen access...';
              const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
              });
              
              video.srcObject = stream;
              status.innerHTML = 'SUCCESS: Screen capture working!';
              console.log('Screen capture successful!');
              
            } catch (error) {
              status.innerHTML = 'ERROR: ' + error.message;
              console.error('Screen capture failed:', error);
            }
          }
        </script>
      </body>
    </html>
  `)
})

app.on('window-all-closed', () => {
  app.quit()
})