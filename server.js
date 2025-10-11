const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.json());
app.use(express.static('public'));

let users = {}; // для хранения username и password

// Регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users[username]) {
    return res.status(400).json({ msg: 'Пользователь уже существует' });
  }
  users[username] = password;
  res.json({ msg: 'Регистрация успешна' });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ msg: 'Вход выполнен' });
  } else {
    res.status(400).json({ msg: 'Неверный логин или пароль' });
  }
});

// WebSocket соединение
io.on('connection', (socket) => {
  console.log('Пользователь подключился');

  // Вход в комнату
  socket.on('joinRoom', ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);
    socket.emit('message', { user: 'Сервер', text: `Добро пожаловать в ${room}, ${username}!` });
    socket.to(room).emit('message', { user: 'Сервер', text: `${username} присоединился к чату` });
  });

  // Приём сообщения и его отправка в выбранную комнату с именем пользователя
  socket.on('chatMessage', (msg) => {
    io.to(socket.room).emit('message', { user: socket.username, text: msg });
  });

  socket.on('disconnect', () => {
    if (socket.username && socket.room) {
      socket.to(socket.room).emit('message', { user: 'Сервер', text: `${socket.username} покинул чат` });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
