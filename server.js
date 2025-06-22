require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { OpenAI } = require('openai');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const roomHistories = {};
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

// Serve static React app
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomId, user }) => {
    if (!user || !user.username) {
      console.error("User info missing");
      return;
    }

    socket.join(roomId);
    socket.user = user;
    console.log(`${socket.id} joined room ${roomId}`);

    io.to(roomId).emit('userJoined', {
      user,
      message: `${user.username} has joined the room.`,
    });

    const history = roomHistories[roomId] || [];
    socket.emit('history', history);
  });

  socket.on('prompt', async ({ roomId, prompt }) => {
    if (!roomId) {
      console.error('Room ID is required');
      return;
    }

    const user = socket.user;
    if (!user) {
      console.error("Prompt received but user is undefined");
      return;
    }

    roomHistories[roomId] = roomHistories[roomId] || [];
    roomHistories[roomId].push({ role: "user", name: user.username, content: prompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // or "gpt-3.5-turbo"
      messages: roomHistories[roomId],
    });

    const aiMessage = response.choices[0].message;
    roomHistories[roomId].push(aiMessage);

    io.to(roomId).emit('response', {
      prompt,
      user,
      response: aiMessage.content,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});