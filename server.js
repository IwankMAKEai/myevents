const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Canvas state: grid[y][x] = color
const CANVAS_WIDTH = 64;
const CANVAS_HEIGHT = 64;
let canvas = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill('#FFFFFF'));

// Events management
let currentEvent = {
  name: 'Классический Пиксель Батл',
  description: 'Рисуй пиксели на общей доске!',
  theme: 'random',
  startTime: new Date(),
  active: true
};

let clients = new Set();

// Broadcast message to all connected clients
function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// WebSocket connections
wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  // Send current canvas state to new client
  ws.send(JSON.stringify({
    type: 'canvas',
    data: canvas,
    event: currentEvent
  }));

  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'pixel') {
        const { x, y, color } = message;
        
        // Validate coordinates
        if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
          canvas[y][x] = color;
          
          // Broadcast pixel change to all clients
          broadcast({
            type: 'pixel',
            x,
            y,
            color,
            username: message.username || 'Anonymous'
          });
        }
      }

      if (message.type === 'clear') {
        canvas = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill('#FFFFFF'));
        broadcast({
          type: 'canvas',
          data: canvas
        });
      }

      if (message.type === 'event') {
        currentEvent = message.data;
        broadcast({
          type: 'event',
          data: currentEvent
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// REST API endpoints

// Get current event
app.get('/api/event', (req, res) => {
  res.json(currentEvent);
});

// Update event
app.post('/api/event', (req, res) => {
  currentEvent = { ...currentEvent, ...req.body };
  broadcast({
    type: 'event',
    data: currentEvent
  });
  res.json(currentEvent);
});

// Get canvas state
app.get('/api/canvas', (req, res) => {
  res.json(canvas);
});

// Clear canvas
app.post('/api/canvas/clear', (req, res) => {
  canvas = Array(CANVAS_HEIGHT).fill(null).map(() => Array(CANVAS_WIDTH).fill('#FFFFFF'));
  broadcast({
    type: 'canvas',
    data: canvas
  });
  res.json({ success: true });
});

// Get canvas statistics
app.get('/api/stats', (req, res) => {
  const colorCount = {};
  canvas.forEach(row => {
    row.forEach(color => {
      colorCount[color] = (colorCount[color] || 0) + 1;
    });
  });

  res.json({
    totalPixels: CANVAS_WIDTH * CANVAS_HEIGHT,
    filledPixels: Object.values(colorCount).reduce((a, b) => a + b, 0) - colorCount['#FFFFFF'],
    colors: colorCount,
    connectedUsers: clients.size
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Pixel Battle server is running!`);
  console.log(`📍 Локально: http://localhost:${PORT}`);
  console.log(`📍 По сети: http://YOUR_IP:${PORT}`);
  console.log(`🌐 С ngrok: ./ngrok http ${PORT}`);
  console.log(`WebSocket готов на ws://0.0.0.0:${PORT}`);
});
