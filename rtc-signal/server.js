const express = require('express');
const { WebSocketServer } = require('ws');
const app = express();
app.use(express.json());

const rooms = new Map(); // roomId -> { offerer:ws, answerer:ws }

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeRooms: rooms.size,
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  };
  res.status(200).json(healthStatus);
});

// API endpoint to get room statistics
app.get('/api/stats', (req, res) => {
  const stats = {
    totalRooms: rooms.size,
    activeConnections: Array.from(rooms.values()).reduce((count, room) => {
      return count + (room.offerer ? 1 : 0) + (room.answerer ? 1 : 0);
    }, 0),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.json(stats);
});

const server = app.listen(process.env.PORT || 8080, () =>
  console.log('HTTP+WS on :', server.address().port)
);
const wss = new WebSocketServer({ server });

// Heartbeat to detect dead connections
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (m) => {
    const { type, room, role, to, data } = JSON.parse(m);
    const entry = rooms.get(room) || {};
    if (type === 'join') {
      entry[role] = ws;
      rooms.set(room, entry);
      return;
    }
    if (type === 'signal') {
      const target = entry[to];
      if (target && target.readyState === 1)
        target.send(JSON.stringify({ type: 'signal', data }));
    }
  });

  // Clean up rooms when connection closes
  ws.on('close', () => {
    rooms.forEach((entry, roomId) => {
      if (entry.offerer === ws || entry.answerer === ws) {
        // Remove the disconnected client
        if (entry.offerer === ws) delete entry.offerer;
        if (entry.answerer === ws) delete entry.answerer;

        // Clean up empty rooms
        if (!entry.offerer && !entry.answerer) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// Ping clients every 30 seconds to detect dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
