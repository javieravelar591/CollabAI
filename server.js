// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Configuration, OpenAIApi, OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// In-memory storage (for now)
const roomHistories = {};
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

const response = openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: roomHistories[roomId],
});

console.log(response);

const roomId = 1
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);

    // Send current history
    const history = roomHistories[roomId] || [];
    socket.emit('history', history);
  });

  // Handle a prompt in a room
  socket.on('prompt', async ({ roomId, prompt }) => {
    console.log(`Prompt in room ${roomId}:`, prompt);

    // Save the prompt
    roomHistories[roomId] = roomHistories[roomId] || [];
    roomHistories[roomId].push({ role: "user", content: prompt });

    // Get AI response
    const response = await openai.createChatCompletion({
      model: "gpt-4o-mini", // or gpt-3.5-turbo
      messages: roomHistories[roomId],
    });

    const aiMessage = response.data.choices[0].message;
    roomHistories[roomId].push(aiMessage);

    // Broadcast to all users in room
    io.to(roomId).emit('response', {
      prompt,
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
