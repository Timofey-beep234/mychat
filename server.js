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

let users = {};
let onlineUsers = {}; // socketId: phone

app.post('/register', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ msg: 'Введите номер и пароль' });
  if (users[phone]) return res.status(400).json({ msg: 'Пользователь уже существует' });
  users[phone] = { password, contacts: [], messages: {}, avatar: '/default-avatar.png' };
  res.json({ msg: 'Registered' });
});

app.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ msg: 'Введите номер и пароль' });
  if (users[phone] && users[phone].password === password) {
    res.json({ msg: 'Logged in', contacts: users[phone].contacts, avatar: users[phone].avatar });
  } else {
    res.status(400).json({ msg: 'Неправильный номер или пароль' });
  }
});

app.post('/upload', upload.single('photo'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Смена номера телефона
app.post('/change-phone', (req, res) => {
  const { oldPhone, newPhone, password } = req.body;
  if (!users[oldPhone]) return res.status(400).json({ msg: 'Старого номера нет' });
  if (users[newPhone]) return res.status(400).json({ msg: 'Новый номер уже используется' });
  if (users[oldPhone].password !== password) return res.status(400).json({ msg: 'Неверный пароль' });
  users[newPhone] = users[oldPhone];
  delete users[oldPhone];

  // Обновление onlineUsers
  Object.keys(onlineUsers).forEach(socketId => {
    if (onlineUsers[socketId] === oldPhone) onlineUsers[socketId] = newPhone;
  });

  res.json({ msg: 'Номер изменён' });
});

// Обновление аватарки
app.post('/change-avatar', upload.single('avatar'), (req, res) => {
  const { phone } = req.body;
  if (!users[phone]) return res.status(400).json({ msg: 'Пользователь не найден' });
  users[phone].avatar = `/uploads/${req.file.filename}`;
  res.json({ url: users[phone].avatar });
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
    if (!users[to]) return;
    if (!users[to].messages[currentUser]) users[to].messages[currentUser] = [];

    const msg = { from: currentUser, text, type, time: Date.now() };
    users[currentUser].messages[to].push(msg);
    users[to].messages[currentUser].push(msg);

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
