// server.js
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const multer = require('multer');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'public/uploads/' });

/*
users: {
  phone: {
    password: string,
    contacts: [{ phone: string }],
    messages: { [contactPhone]: [msg] }
  }
}
*/
let users = {};
let onlineUsers = {}; // socketId: phone

app.post('/register', (req, res) => {
  const { phone, password } = req.body;
  if (users[phone]) return res.status(400).json({ msg: 'User exists' });
  users[phone] = { password, contacts: [], messages: {} };
  res.json({ msg: 'Registered' });
});

app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (users[phone] && users[phone].password === password) {
    res.json({ msg: 'Logged in', contacts: users[phone].contacts });
  } else {
    res.status(400).json({ msg: 'Wrong phone or password' });
  }
});

app.post('/upload', upload.single('photo'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('login', (phone) => {
    currentUser = phone;
    onlineUsers[socket.id] = phone;
  });

  socket.on('addContact', (contactPhone) => {
    if (!users[currentUser]) return;
    if (!users[currentUser].contacts.find(c => c.phone === contactPhone)) {
      users[currentUser].contacts.push({ phone: contactPhone });
      users[currentUser].messages[contactPhone] = users[currentUser].messages[contactPhone] || [];
    }
    socket.emit('updateContacts', users[currentUser].contacts);
  });

  socket.on('sendMessage', ({ to, text, type }) => {
    if (!users[currentUser]) return;
    if (!users[currentUser].messages[to]) users[currentUser].messages[to] = [];
    if (!users[to]) return; // Recipient must be registered
    if (!users[to].messages[currentUser]) users[to].messages[currentUser] = [];

    const msg = { from: currentUser, text, type, time: Date.now() };
    users[currentUser].messages[to].push(msg);
    users[to].messages[currentUser].push(msg);

    // Notify sender and receiver
    io.sockets.sockets.forEach((s) => {
      const phone = onlineUsers[s.id];
      if (phone === to || phone === currentUser) {
        s.emit('newMessage', { contact: (phone === to) ? currentUser : to, message: msg });
      }
    });
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
