// server.js
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const multer = require('multer');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'public/uploads/' });

let users = {}; // username: {password, contacts: [], messages: {contact: [messages]}}
let onlineUsers = {}; // socket.id: username

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ msg: 'User exists' });
  users[username] = { password, contacts: [], messages: {} };
  res.json({ msg: 'Registered' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username].password === password) {
    res.json({ msg: 'Logged in', contacts: users[username].contacts });
  } else {
    res.status(400).json({ msg: 'Wrong username or password' });
  }
});

app.post('/upload', upload.single('photo'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('login', (username) => {
    currentUser = username;
    onlineUsers[socket.id] = username;
  });

  socket.on('addContact', (contact) => {
    if (!users[currentUser].contacts.includes(contact)) {
      users[currentUser].contacts.push(contact);
      users[currentUser].messages[contact] = users[currentUser].messages[contact] || [];
    }
  });

  socket.on('sendMessage', ({ to, text, type }) => {
    const msg = { from: currentUser, text, type, time: Date.now() };
    if (!users[currentUser].messages[to]) users[currentUser].messages[to] = [];
    if (!users[to].messages[currentUser]) users[to].messages[currentUser] = [];
    users[currentUser].messages[to].push(msg);
    users[to].messages[currentUser].push(msg);
    io.sockets.sockets.forEach((s) => {
      if (onlineUsers[s.id] === to || onlineUsers[s.id] === currentUser) {
        s.emit('newMessage', { contact: (onlineUsers[s.id] === to) ? currentUser : to, message: msg });
      }
    });
  });

  socket.on('callUser', ({ to }) => {
    io.sockets.sockets.forEach((s) => {
      if (onlineUsers[s.id] === to) {
        s.emit('incomingCall', { from: currentUser });
      }
    });
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
