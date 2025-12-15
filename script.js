document.addEventListener('DOMContentLoaded', () => {
    // === Элементы ===
    const authScreen = document.getElementById('auth-screen');
    const chatScreen = document.getElementById('chat-screen');

    const authForm = document.getElementById('auth-form');
    const nicknameInput = document.getElementById('nickname');
    const passwordInput = document.getElementById('password');
    const authError = document.getElementById('auth-error');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');

    const userNicknameElement = document.getElementById('user-nickname');
    const settingsNickname = document.getElementById('settings-nickname');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettings = document.getElementById('close-settings');
    const logoutBtn = document.getElementById('logout-btn');

    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResult = document.getElementById('search-result');
    const currentChatWith = document.getElementById('current-chat-with');

    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const messageForm = document.getElementById('message-form');

    let currentRecipient = null;
    let myNickname = null;

    // === Вкладки ===
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        authForm.setAttribute('data-action', 'login');
        authError.textContent = '';
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        authForm.setAttribute('data-action', 'register');
        authError.textContent = '';
    });

    // === Авторизация ===
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nickname = nicknameInput.value.trim();
        const password = passwordInput.value.trim();
        const action = authForm.getAttribute('data-action');

        if (!nickname || !password) {
            authError.textContent = 'Введите ник и пароль';
            return;
        }

        try {
            const res = await fetch(`/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, password })
            });

            const data = await res.json();

            if (data.success) {
                myNickname = nickname;
                userNicknameElement.textContent = nickname;
                settingsNickname.textContent = nickname;
                authScreen.style.display = 'none';
                chatScreen.style.display = 'flex';
                socket.emit('authenticate', nickname);
            } else {
                authError.textContent = data.error;
            }
        } catch (err) {
            authError.textContent = 'Ошибка подключения';
        }
    });

    // === Socket.IO ===
    const socket = io();

    socket.on('auth-success', (data) => {
        console.log(`🟢 Добро пожаловать, ${data.nickname}!`);
    });

    // === Поиск ===
    searchBtn.addEventListener('click', () => {
        const nick = searchInput.value.trim();
        if (!nick) {
            searchResult.textContent = 'Введите ник';
            return;
        }
        searchResult.textContent = 'Поиск...';
        socket.emit('search-user', nick);
    });

    socket.on('search-result', (result) => {
        if (result.online) {
            searchResult.textContent = `✅ ${result.nickname} — в сети`;
            currentRecipient = result.nickname;
            currentChatWith.textContent = result.nickname;
        } else {
            searchResult.textContent = `❌ ${result.nickname} — не в сети`;
            currentRecipient = null;
            currentChatWith.textContent = 'никто';
        }
    });

    // === Отправка сообщения ===
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();

        if (!message) return;
        if (!currentRecipient) {
            alert('Сначала найдите пользователя');
            return;
        }

        socket.emit('private-message', {
            to: currentRecipient,
            message: message
        });

        const div = document.createElement('div');
        div.classList.add('message', 'sent');
        div.textContent = message;
        messagesContainer.appendChild(div);
        messageInput.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // === Получение сообщения ===
    socket.on('private-message', (data) => {
        const div = document.createElement('div');
        div.classList.add('message', 'received');
        div.innerHTML = `<strong>${data.from}:</strong> ${data.message}`;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // === Настройки ===
    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'block';
    });

    closeSettings.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
    });

    logoutBtn.addEventListener('click', () => {
        location.reload(); // просто перезагрузка — вернёт на экран входа
    });
});