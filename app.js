/**
 * The Between Us - Synchronized Cinema for Two
 * Powered by Hasatz Solutions Private Limited
 */

// ==================== STATE MANAGEMENT ====================
const state = {
  user: {
    id: '',
    name: '',
    avatar: '🍿',
    avatarUrl: '',
    email: '',
    authProvider: 'guest' // 'google' | 'guest'
  },
  room: {
    id: null,
    isOffline: false,
    participants: [],
    media: {
      type: 'direct', // 'local' | 'youtube' | 'direct' | 'stream_companion'
      title: 'Sintel - Open Cinema Trailer (Sample)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      youtubeId: '',
      fileName: '',
      companionService: ''
    },
    playback: {
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1.0,
      isBuffering: false
    }
  },
  socket: null,
  socketConnected: false,
  latency: 18,
  serverUrl: window.location.origin.includes(':5173') 
    ? window.location.origin.replace(':5173', ':3001') 
    : window.location.origin,
  ytPlayer: null,
  ytReady: false,
  isIgnoreNextSync: false,
  lastSyncTime: 0,
  chatMessages: [],
  notes: [],
  isChatOpen: false,
  longDistanceDomain: ''
};

// Available Avatars
const CINEMA_AVATARS = ['🍿', '🎬', '❤️', '🌟', '🐱', '🦊', '🚀', '🎭', '👑', '🕶️', '💃', '🕺', '🔥', '✨'];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();
  initSocket();
  initEventListeners();
  initYouTubeAPI();
  registerServiceWorker();
  
  // Check URL params for room code invite (e.g. ?room=AB7K9)
  const urlParams = new URLSearchParams(window.location.search);
  const inviteRoom = urlParams.get('room');
  if (inviteRoom) {
    const joinInput = document.getElementById('joinRoomInput');
    if (joinInput) joinInput.value = inviteRoom.toUpperCase();
  }
});

// ==================== USER PROFILE & AUTHENTICATION ====================
function initUserProfile() {
  const saved = localStorage.getItem('wr_user_profile');
  if (saved) {
    try {
      state.user = { ...state.user, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to parse user profile', e);
    }
  }

  if (!state.user.id) {
    state.user.id = 'usr_' + Math.random().toString(36).substring(2, 9);
  }

  renderAuthAvatarPicker();
  renderAvatarPicker();

  const authView = document.getElementById('authView');
  const lobbyView = document.getElementById('lobbyView');
  const emailInput = document.getElementById('authEmailInput');
  const nameInput = document.getElementById('authNameInput');

  if (emailInput && state.user.email) emailInput.value = state.user.email;
  if (nameInput && state.user.name && !state.user.name.startsWith('Viewer_')) nameInput.value = state.user.name;

  // If user has already signed in with an email, take them directly to lobby
  if (state.user.isLoggedIn && state.user.email) {
    if (authView) authView.classList.add('hidden');
    if (lobbyView) lobbyView.classList.remove('hidden');
  } else {
    // Show Email Login First
    if (authView) authView.classList.remove('hidden');
    if (lobbyView) lobbyView.classList.add('hidden');
  }

  updateProfileUI();
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('authEmailInput')?.value?.trim();
  const name = document.getElementById('authNameInput')?.value?.trim();

  if (!email || !name) {
    alert('Please enter both your email address and display name.');
    return;
  }

  state.user.email = email;
  state.user.name = name;
  state.user.isLoggedIn = true;
  state.user.authProvider = email.toLowerCase().includes('@gmail.com') ? 'google' : 'email';

  saveUserProfile();
  updateProfileUI();

  // Transition to Lobby
  document.getElementById('authView')?.classList.add('hidden');
  document.getElementById('lobbyView')?.classList.remove('hidden');

  showToast(`Welcome, ${state.user.name}! 👋`);
}

function handleQuickGoogleLogin() {
  const currentEmail = state.user.email || '';
  const email = prompt('Enter your Google / Gmail address:', currentEmail.includes('@gmail.com') ? currentEmail : 'yourname@gmail.com');
  if (!email || !email.includes('@')) return;

  const defaultName = email.split('@')[0];
  const name = prompt('Enter your Display Name:', state.user.name || defaultName);
  if (!name) return;

  state.user.email = email.trim();
  state.user.name = name.trim();
  state.user.isLoggedIn = true;
  state.user.authProvider = 'google';

  saveUserProfile();
  updateProfileUI();

  document.getElementById('authView')?.classList.add('hidden');
  document.getElementById('lobbyView')?.classList.remove('hidden');

  showToast(`Signed in with Google: ${state.user.name} 🎬`);
}

function handleGuestLogin() {
  if (!state.user.name || state.user.name.startsWith('MovieLover_')) {
    state.user.name = 'Viewer_' + Math.floor(100 + Math.random() * 900);
  }
  state.user.isLoggedIn = true;
  state.user.authProvider = 'guest';

  saveUserProfile();
  updateProfileUI();

  document.getElementById('authView')?.classList.add('hidden');
  document.getElementById('lobbyView')?.classList.remove('hidden');

  showToast(`Continuing as Guest: ${state.user.name}`);
}

function switchAccount() {
  state.user.isLoggedIn = false;
  saveUserProfile();

  document.getElementById('roomView')?.classList.add('hidden');
  document.getElementById('lobbyView')?.classList.add('hidden');
  document.getElementById('authView')?.classList.remove('hidden');
  closeProfileModal();
}

function renderAuthAvatarPicker() {
  const container = document.getElementById('authAvatarPickerGrid');
  if (!container) return;

  container.innerHTML = CINEMA_AVATARS.map(av => `
    <button type="button" onclick="selectAvatar('${av}')" class="text-xl sm:text-2xl p-1.5 rounded-lg hover:bg-white/10 transition ${state.user.avatar === av ? 'bg-[#e50914]/30 border border-[#e50914]' : ''}">
      ${av}
    </button>
  `).join('');
}

function handleAuthPhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.user.avatarUrl = e.target.result;
    state.user.avatar = '';
    updateProfileUI();
    showToast('Photo uploaded! 📸');
  };
  reader.readAsDataURL(file);
}

function saveUserProfile() {
  localStorage.setItem('wr_user_profile', JSON.stringify(state.user));
}

function updateProfileUI() {
  const avatarDisplays = document.querySelectorAll('.user-avatar-display');
  const nameDisplays = document.querySelectorAll('.user-name-display');
  const emailDisplays = document.querySelectorAll('.user-email-display');

  avatarDisplays.forEach(el => {
    if (state.user.avatarUrl) {
      el.innerHTML = `<img src="${state.user.avatarUrl}" class="w-full h-full object-cover rounded-full" />`;
    } else {
      el.textContent = state.user.avatar || '🍿';
    }
  });

  nameDisplays.forEach(el => el.textContent = state.user.name || 'Guest');
  emailDisplays.forEach(el => el.textContent = state.user.email || 'Guest');
}

// ==================== SOCKET.IO SYNC ENGINE ====================
function initSocket() {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client library not found, running in standalone/offline mode.');
    updateConnectionStatus(false);
    return;
  }

  try {
    const socketHost = state.serverUrl.startsWith('file:') ? 'http://localhost:3001' : state.serverUrl;
    state.socket = io(socketHost, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnectionAttempts: 10
    });

    state.socket.on('connect', () => {
      console.log('⚡ Connected to WatchRoom Sync Server:', state.socket.id);
      state.socketConnected = true;
      updateConnectionStatus(true);
      measureLatency();
    });

    state.socket.on('disconnect', () => {
      console.log('⚠️ Disconnected from WatchRoom Sync Server');
      state.socketConnected = false;
      updateConnectionStatus(false);
    });

    state.socket.on('room:updated', (data) => {
      state.room.participants = data.participants || [];
      if (data.currentMedia && data.currentMedia.title !== state.room.media.title) {
        setMediaSource(data.currentMedia, false);
      }
      renderParticipants();
    });

    state.socket.on('sync:play', (data) => {
      if (data.senderId === state.socket.id) return;
      handleRemotePlay(data.currentTime);
      showToast(`${data.senderName} played video`);
    });

    state.socket.on('sync:pause', (data) => {
      if (data.senderId === state.socket.id) return;
      handleRemotePause(data.currentTime);
      showToast(`${data.senderName} paused video`);
    });

    state.socket.on('sync:seek', (data) => {
      if (data.senderId === state.socket.id) return;
      handleRemoteSeek(data.targetTime, data.isPlaying);
      showToast(`${data.senderName} jumped to ${formatTime(data.targetTime)}`);
    });

    state.socket.on('sync:media_changed', (data) => {
      if (data.senderId === state.socket.id) return;
      setMediaSource(data.media, false);
      showToast(`${data.senderName} loaded "${data.media.title}"`);
    });

    state.socket.on('chat:received', (msg) => {
      appendChatMessage(msg);
    });

    state.socket.on('sync:reaction_burst', (data) => {
      showToast(`${data.senderName}: ${data.emoji}`);
    });

    state.socket.on('system:notification', (data) => {
      showToast(data.message);
    });

    // Periodic Heartbeat
    setInterval(() => {
      if (state.socketConnected && state.room.id && !state.room.isOffline) {
        state.socket.emit('sync:heartbeat', {
          currentTime: getCurrentPlaybackTime(),
          isPlaying: state.room.playback.isPlaying,
          latency: state.latency
        });
      }
    }, 4000);

  } catch (err) {
    console.error('Socket initialization error:', err);
    updateConnectionStatus(false);
  }
}

function updateConnectionStatus(isOnline) {
  const badge = document.getElementById('networkStatusBadge');
  const label = document.getElementById('networkStatusLabel');
  const dot = document.getElementById('networkStatusDot');

  if (!badge) return;

  if (isOnline) {
    label.textContent = `Online (${state.latency}ms)`;
    dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    badge.className = 'flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1 rounded-full';
  } else {
    label.textContent = state.room.isOffline ? 'Offline Mode' : 'Connecting...';
    dot.className = 'w-2 h-2 rounded-full bg-amber-500';
    badge.className = 'flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-950/50 border border-amber-800/40 px-2.5 py-1 rounded-full';
  }
}

function measureLatency() {
  if (!state.socket || !state.socketConnected) return;
  const start = Date.now();
  state.socket.emit('ping:client', start, (clientTime) => {
    state.latency = Math.max(8, Math.round((Date.now() - clientTime) / 2));
    updateConnectionStatus(true);
  });
}

// ==================== ROOM MANAGEMENT ====================
function createRoom() {
  if (!state.socketConnected) {
    // Generate offline room code
    const randomCode = 'L' + Math.random().toString(36).substring(2, 6).toUpperCase();
    enterRoom(randomCode, true);
    return;
  }

  state.socket.emit('room:join', {
    userId: state.user.id,
    userName: state.user.name,
    userAvatar: state.user.avatar,
    userAvatarUrl: state.user.avatarUrl,
    email: state.user.email,
    authProvider: state.user.authProvider
  }, (response) => {
    if (response && response.success) {
      enterRoom(response.roomId, false, response.participants);
    } else {
      alert(response?.error || 'Failed to create room. Starting offline.');
      enterRoom('OFFL1', true);
    }
  });
}

function joinRoom(code) {
  const roomCode = (code || document.getElementById('joinRoomInput')?.value || '').trim().toUpperCase();
  if (!roomCode) {
    alert('Please enter a valid 5-character Room Code!');
    return;
  }

  if (!state.socketConnected) {
    enterRoom(roomCode, true);
    return;
  }

  state.socket.emit('room:join', {
    roomId: roomCode,
    userId: state.user.id,
    userName: state.user.name,
    userAvatar: state.user.avatar,
    userAvatarUrl: state.user.avatarUrl,
    email: state.user.email,
    authProvider: state.user.authProvider
  }, (response) => {
    if (response && response.success) {
      enterRoom(response.roomId, false, response.participants);
    } else {
      alert(response?.error || 'Room not found or is full.');
    }
  });
}

function startOfflineMode() {
  enterRoom('OFFLINE', true);
}

function enterRoom(roomId, isOffline = false, initialParticipants = []) {
  state.room.id = roomId;
  state.room.isOffline = isOffline;
  
  if (isOffline) {
    state.room.participants = [{
      id: 'self',
      userId: state.user.id,
      name: state.user.name,
      avatar: state.user.avatar,
      avatarUrl: state.user.avatarUrl,
      email: state.user.email,
      isPlaying: false,
      latency: 0
    }];
  } else if (initialParticipants.length > 0) {
    state.room.participants = initialParticipants;
  }

  // Hide Lobby, Show Room View
  document.getElementById('lobbyView').classList.add('hidden');
  document.getElementById('roomView').classList.remove('hidden');
  document.getElementById('roomCodeDisplay').textContent = roomId;
  
  updateConnectionStatus(!isOffline && state.socketConnected);
  renderParticipants();
  loadOfflineNotes();
  showToast(`Joined Room: ${roomId}`);
}

function leaveRoom() {
  if (confirm('Leave this WatchRoom session?')) {
    if (state.socket && state.socketConnected && state.room.id && !state.room.isOffline) {
      state.socket.emit('room:leave');
    }
    state.room.id = null;
    state.room.isOffline = false;
    state.room.participants = [];
    
    // Pause video
    const video = document.getElementById('videoPlayer');
    if (video) video.pause();
    if (state.ytPlayer && typeof state.ytPlayer.pauseVideo === 'function') state.ytPlayer.pauseVideo();

    document.getElementById('roomView').classList.add('hidden');
    document.getElementById('lobbyView').classList.remove('hidden');
  }
}

// ==================== 2-PERSON PARTICIPANTS UI ====================
function renderParticipants() {
  const container = document.getElementById('participantsList');
  if (!container) return;

  const self = state.room.participants.find(p => p.userId === state.user.id) || {
    name: state.user.name,
    avatar: state.user.avatar,
    avatarUrl: state.user.avatarUrl,
    email: state.user.email
  };
  const partner = state.room.participants.find(p => p.userId !== state.user.id);

  let html = `
    <!-- User 1 (You) -->
    <div class="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
      <div class="w-7 h-7 rounded-full bg-red-600/30 flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
        ${self.avatarUrl ? `<img src="${self.avatarUrl}" class="w-full h-full object-cover" />` : (self.avatar || '🍿')}
      </div>
      <div class="leading-tight">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-semibold text-white">${escapeHtml(self.name)}</span>
          <span class="text-[10px] text-gray-400">(You)</span>
        </div>
        <span class="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Sync (${state.latency}ms)
        </span>
      </div>
    </div>
  `;

  if (partner) {
    html += `
      <!-- User 2 (Partner) -->
      <div class="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
        <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs overflow-hidden flex-shrink-0">
          ${partner.avatarUrl ? `<img src="${partner.avatarUrl}" class="w-full h-full object-cover" />` : (partner.avatar || '🎬')}
        </div>
        <div class="leading-tight">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-white">${escapeHtml(partner.name)}</span>
            <span class="text-[10px] text-[#e50914] font-medium">Partner</span>
          </div>
          <span class="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online (${partner.latency || 20}ms)
          </span>
        </div>
      </div>
    `;
  } else {
    html += `
      <!-- Waiting for Partner -->
      <button onclick="openInviteModal()" class="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 px-3 py-1.5 rounded-lg text-left transition">
        <div class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-gray-400 text-xs">
          <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
        </div>
        <div class="leading-tight">
          <div class="text-xs font-medium text-gray-300">Invite Partner</div>
          <span class="text-[10px] text-gray-500">WhatsApp / QR</span>
        </div>
      </button>
    `;
  }

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// ==================== VIDEO ENGINE & CONTROLS ====================
let controlsHideTimer = null;

function initEventListeners() {
  const video = document.getElementById('videoPlayer');
  const videoStage = document.getElementById('videoStage');
  const videoTouchLayer = document.getElementById('videoTouchLayer');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const centerPlayBtn = document.getElementById('centerPlayBtn');
  const skipForwardBtn = document.getElementById('skipForwardBtn');
  const skipBackwardBtn = document.getElementById('skipBackwardBtn');
  const seekSlider = document.getElementById('seekSlider');
  const volumeSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  const speedSelect = document.getElementById('speedSelect');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  // Video Events
  if (video) {
    video.addEventListener('play', () => {
      state.room.playback.isPlaying = true;
      updatePlayPauseButton(true);
      emitSyncAction('play', { currentTime: video.currentTime });
    });

    video.addEventListener('pause', () => {
      state.room.playback.isPlaying = false;
      updatePlayPauseButton(false);
      emitSyncAction('pause', { currentTime: video.currentTime });
    });

    let lastTimeUpdate = 0;
    video.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastTimeUpdate < 250) return;
      lastTimeUpdate = now;

      if (!isSeeking) {
        const dur = video.duration || 0;
        seekSlider.value = dur ? (video.currentTime / dur) * 100 : 0;
        document.getElementById('timeDisplay').textContent = `${formatTime(video.currentTime)} / ${formatTime(dur)}`;
      }
    });

    video.addEventListener('waiting', () => {
      document.getElementById('bufferingSpinner')?.classList.remove('hidden');
    });

    video.addEventListener('playing', () => {
      document.getElementById('bufferingSpinner')?.classList.add('hidden');
    });
  }

  // Play/Pause button (Bottom bar)
  playPauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });

  // Center Play/Pause Overlay Button (Click directly toggles play/pause for either member)
  centerPlayBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });

  // Screen Touch / Gesture Detection on Video
  let lastTapLeft = 0;
  let lastTapRight = 0;

  const zoneLeft = document.getElementById('gestureZoneLeft');
  const zoneRight = document.getElementById('gestureZoneRight');
  const zoneCenter = document.getElementById('gestureZoneCenter');

  zoneLeft?.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapLeft < 350) {
      seekDelta(-10);
      showTouchRipple('-10s');
      lastTapLeft = 0;
    } else {
      lastTapLeft = now;
      showControlsTemporarily(2500);
    }
  });

  zoneRight?.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRight < 350) {
      seekDelta(10);
      showTouchRipple('+10s');
      lastTapRight = 0;
    } else {
      lastTapRight = now;
      showControlsTemporarily(2500);
    }
  });

  zoneCenter?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleScreenTap();
  });

  videoTouchLayer?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleScreenTap();
  });

  videoStage?.addEventListener('mousemove', () => {
    showControlsTemporarily(2500);
  });

  videoStage?.addEventListener('touchstart', () => {
    showControlsTemporarily(3000);
  }, { passive: true });

  // 10s Skip Buttons
  skipForwardBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    seekDelta(10);
    showTouchRipple('+10s');
    showControlsTemporarily(2000);
  });

  skipBackwardBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    seekDelta(-10);
    showTouchRipple('-10s');
    showControlsTemporarily(2000);
  });

  // Seek Slider
  let isSeeking = false;
  seekSlider?.addEventListener('input', (e) => {
    isSeeking = true;
    const time = (e.target.value / 100) * getVideoDuration();
    document.getElementById('timeDisplay').textContent = `${formatTime(time)} / ${formatTime(getVideoDuration())}`;
  });

  seekSlider?.addEventListener('change', (e) => {
    isSeeking = false;
    const time = (e.target.value / 100) * getVideoDuration();
    seekTo(time);
  });

  // Volume & Mute
  volumeSlider?.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    if (video) video.volume = vol;
    if (state.ytPlayer && typeof state.ytPlayer.setVolume === 'function') state.ytPlayer.setVolume(vol * 100);
  });

  muteBtn?.addEventListener('click', () => {
    if (video) {
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted ? '<i data-lucide="volume-x" class="w-5 h-5 text-red-400"></i>' : '<i data-lucide="volume-2" class="w-5 h-5"></i>';
      if (window.lucide) lucide.createIcons();
    }
  });

  // Speed
  speedSelect?.addEventListener('change', (e) => {
    const rate = parseFloat(e.target.value);
    if (video) video.playbackRate = rate;
    if (state.ytPlayer && typeof state.ytPlayer.setPlaybackRate === 'function') state.ytPlayer.setPlaybackRate(rate);
    showToast(`Speed: ${rate}x`);
  });

  // Fullscreen
  fullscreenBtn?.addEventListener('click', toggleFullscreen);

  // Local File Input
  document.getElementById('localVideoFileInput')?.addEventListener('change', handleLocalFileSelect);

  // Reaction Bar
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      triggerReaction(emoji);
    });
  });

  // Chat Input
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');

  chatSendBtn?.addEventListener('click', sendChatMessage);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
}

function handleScreenTap() {
  const centerBtn = document.getElementById('centerPlayBtn');
  const isCurrentlyHidden = centerBtn?.classList.contains('is-hidden');

  if (isCurrentlyHidden) {
    // Reveal center button and controls on tap
    showControlsTemporarily(3000);
  } else {
    // If already visible, tapping screen toggles play/pause
    togglePlayPause();
  }
}

function showControlsTemporarily(duration = 2500) {
  const centerBtn = document.getElementById('centerPlayBtn');
  if (!centerBtn) return;

  centerBtn.classList.remove('is-hidden');
  centerBtn.classList.add('is-visible');

  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }

  // Auto-hide only if video is actively playing
  if (state.room.playback.isPlaying) {
    controlsHideTimer = setTimeout(() => {
      if (state.room.playback.isPlaying) {
        centerBtn.classList.remove('is-visible');
        centerBtn.classList.add('is-hidden');
      }
    }, duration);
  }
}

function togglePlayPause() {
  if (state.room.media.type === 'youtube' && state.ytPlayer) {
    const playerState = state.ytPlayer.getPlayerState();
    if (playerState === YT.PlayerState.PLAYING) {
      state.ytPlayer.pauseVideo();
    } else {
      state.ytPlayer.playVideo();
    }
    return;
  }

  const video = document.getElementById('videoPlayer');
  if (!video) return;

  if (video.paused) {
    video.play().catch(e => console.log('Autoplay prevent:', e));
  } else {
    video.pause();
  }
}

function updatePlayPauseButton(isPlaying) {
  const btn = document.getElementById('playPauseBtn');
  const centerBtn = document.getElementById('centerPlayBtn');
  
  if (btn) {
    btn.innerHTML = isPlaying 
      ? '<i data-lucide="pause" class="w-4 h-4 fill-current"></i>' 
      : '<i data-lucide="play" class="w-4 h-4 fill-current"></i>';
  }

  if (centerBtn) {
    centerBtn.innerHTML = isPlaying
      ? '<i data-lucide="pause" class="w-7 h-7 fill-current"></i>'
      : '<i data-lucide="play" class="w-7 h-7 ml-1 fill-current"></i>';

    if (isPlaying) {
      centerBtn.classList.remove('is-hidden');
      centerBtn.classList.add('is-visible');
      if (controlsHideTimer) clearTimeout(controlsHideTimer);
      controlsHideTimer = setTimeout(() => {
        if (state.room.playback.isPlaying) {
          centerBtn.classList.remove('is-visible');
          centerBtn.classList.add('is-hidden');
        }
      }, 1000);
    } else {
      if (controlsHideTimer) clearTimeout(controlsHideTimer);
      centerBtn.classList.remove('is-hidden');
      centerBtn.classList.add('is-visible');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function seekDelta(seconds) {
  const current = getCurrentPlaybackTime();
  const dur = getVideoDuration();
  const target = Math.max(0, Math.min(dur, current + seconds));
  seekTo(target);
}

function seekTo(time) {
  if (state.room.media.type === 'youtube' && state.ytPlayer) {
    state.ytPlayer.seekTo(time, true);
  } else {
    const video = document.getElementById('videoPlayer');
    if (video) video.currentTime = time;
  }
  emitSyncAction('seek', { targetTime: time, isPlaying: state.room.playback.isPlaying });
}

function getCurrentPlaybackTime() {
  if (state.room.media.type === 'youtube' && state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function') {
    return state.ytPlayer.getCurrentTime();
  }
  const video = document.getElementById('videoPlayer');
  return video ? video.currentTime : 0;
}

function getVideoDuration() {
  if (state.room.media.type === 'youtube' && state.ytPlayer && typeof state.ytPlayer.getDuration === 'function') {
    return state.ytPlayer.getDuration() || 0;
  }
  const video = document.getElementById('videoPlayer');
  return video ? (video.duration || 0) : 0;
}

function toggleFullscreen() {
  const container = document.getElementById('videoStage');
  if (!document.fullscreenElement) {
    container?.requestFullscreen().catch(err => {
      alert(`Fullscreen error: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

function showTouchRipple(text) {
  const ripple = document.getElementById('seekRippleIndicator');
  if (!ripple) return;
  ripple.textContent = text;
  ripple.classList.remove('opacity-0', 'scale-75');
  ripple.classList.add('opacity-100', 'scale-100');
  setTimeout(() => {
    ripple.classList.remove('opacity-100', 'scale-100');
    ripple.classList.add('opacity-0', 'scale-75');
  }, 600);
}

// ==================== SYNC TRANSMITTER & RECEIVER ====================
function emitSyncAction(action, data) {
  if (state.isIgnoreNextSync) return;
  if (!state.socket || !state.socketConnected || state.room.isOffline || !state.room.id) return;

  const payload = { ...data, actionId: Math.random().toString(36).substring(2, 8) };

  if (action === 'play') state.socket.emit('sync:play', payload);
  if (action === 'pause') state.socket.emit('sync:pause', payload);
  if (action === 'seek') state.socket.emit('sync:seek', payload);
}

function handleRemotePlay(currentTime) {
  state.isIgnoreNextSync = true;
  state.room.playback.isPlaying = true;
  updatePlayPauseButton(true);

  if (state.room.media.type === 'youtube' && state.ytPlayer) {
    if (Math.abs(state.ytPlayer.getCurrentTime() - currentTime) > 1.5) {
      state.ytPlayer.seekTo(currentTime, true);
    }
    state.ytPlayer.playVideo();
  } else {
    const video = document.getElementById('videoPlayer');
    if (video) {
      const diff = currentTime - video.currentTime;
      if (Math.abs(diff) > 1.2) {
        video.currentTime = currentTime;
      } else if (Math.abs(diff) > 0.25) {
        // Silky micro-drift adjustment (avoids audio pops)
        video.playbackRate = diff > 0 ? 1.05 : 0.95;
        setTimeout(() => {
          if (video && state.room.playback.isPlaying) video.playbackRate = 1.0;
        }, 1000);
      }
      video.play().catch(e => console.log(e));
    }
  }
  setTimeout(() => state.isIgnoreNextSync = false, 350);
}

function handleRemotePause(currentTime) {
  state.isIgnoreNextSync = true;
  state.room.playback.isPlaying = false;
  updatePlayPauseButton(false);

  if (state.room.media.type === 'youtube' && state.ytPlayer) {
    state.ytPlayer.pauseVideo();
    if (typeof currentTime === 'number') state.ytPlayer.seekTo(currentTime, true);
  } else {
    const video = document.getElementById('videoPlayer');
    if (video) {
      video.playbackRate = 1.0;
      video.pause();
      if (typeof currentTime === 'number') video.currentTime = currentTime;
    }
  }
  setTimeout(() => state.isIgnoreNextSync = false, 350);
}

function handleRemoteSeek(targetTime, isPlaying) {
  state.isIgnoreNextSync = true;
  state.room.playback.isPlaying = !!isPlaying;
  updatePlayPauseButton(!!isPlaying);

  if (state.room.media.type === 'youtube' && state.ytPlayer) {
    state.ytPlayer.seekTo(targetTime, true);
    if (isPlaying) state.ytPlayer.playVideo();
  } else {
    const video = document.getElementById('videoPlayer');
    if (video) {
      video.playbackRate = 1.0;
      video.currentTime = targetTime;
      if (isPlaying && video.paused) video.play().catch(e => console.log(e));
    }
  }
  setTimeout(() => state.isIgnoreNextSync = false, 350);
}

// ==================== MULTI-SOURCE MEDIA SWITCHER ====================
function handleLocalFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Revoke previous blob to save device RAM
  if (state.room.media.url && state.room.media.url.startsWith('blob:')) {
    try { URL.revokeObjectURL(state.room.media.url); } catch(e) {}
  }

  const localUrl = URL.createObjectURL(file);
  const mediaData = {
    type: 'local',
    title: file.name.replace(/\.[^/.]+$/, ""),
    url: localUrl,
    fileName: file.name
  };

  setMediaSource(mediaData, true);
  closeMediaModal();
  showToast(`Loaded: ${file.name}`);
}

function loadYouTubeUrl(urlOrId) {
  let ytId = urlOrId.trim();
  const match = ytId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) ytId = match[1];

  if (!ytId || ytId.length !== 11) {
    alert('Please enter a valid YouTube Video URL or 11-character Video ID!');
    return;
  }

  const mediaData = {
    type: 'youtube',
    title: `YouTube Video (${ytId})`,
    youtubeId: ytId
  };

  setMediaSource(mediaData, true);
  closeMediaModal();
}

function loadDirectStreamUrl(url, title = 'Web Stream') {
  if (!url || !url.startsWith('http')) {
    alert('Please enter a valid stream URL starting with http/https');
    return;
  }

  const mediaData = {
    type: 'direct',
    title: title || 'Direct Stream',
    url: url
  };

  setMediaSource(mediaData, true);
  closeMediaModal();
}

function setMediaSource(media, emitChange = true) {
  state.room.media = media;
  document.getElementById('currentVideoTitle').textContent = media.title;

  const videoElement = document.getElementById('videoPlayer');
  const ytContainer = document.getElementById('ytPlayerContainer');
  const companionBanner = document.getElementById('companionBanner');

  // Reset Containers
  videoElement?.classList.add('hidden');
  ytContainer?.classList.add('hidden');
  companionBanner?.classList.add('hidden');

  if (media.type === 'youtube') {
    ytContainer?.classList.remove('hidden');
    if (videoElement) videoElement.pause();
    loadYouTubeVideo(media.youtubeId);
  } else if (media.type === 'stream_companion') {
    companionBanner?.classList.remove('hidden');
    document.getElementById('companionServiceName').textContent = media.companionService || 'Streaming Platform';
  } else {
    // Local or Direct MP4/WebM
    videoElement?.classList.remove('hidden');
    if (videoElement && media.url) {
      videoElement.src = media.url;
      videoElement.load();
    }
  }

  if (emitChange && state.socket && state.socketConnected && state.room.id && !state.room.isOffline) {
    state.socket.emit('sync:media_change', media);
  }
}

// ==================== YOUTUBE IFRAME API ====================
function initYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  window.onYouTubeIframeAPIReady = () => {
    state.ytReady = true;
  };
}

function loadYouTubeVideo(videoId) {
  if (!state.ytReady) {
    setTimeout(() => loadYouTubeVideo(videoId), 300);
    return;
  }

  if (state.ytPlayer) {
    state.ytPlayer.loadVideoById(videoId);
  } else {
    state.ytPlayer = new YT.Player('ytPlayerFrame', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        'playsinline': 1,
        'controls': 0,
        'rel': 0,
        'modestbranding': 1
      },
      events: {
        'onStateChange': onYouTubeStateChange
      }
    });
  }
}

function onYouTubeStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    state.room.playback.isPlaying = true;
    updatePlayPauseButton(true);
    emitSyncAction('play', { currentTime: state.ytPlayer.getCurrentTime() });
  } else if (event.data === YT.PlayerState.PAUSED) {
    state.room.playback.isPlaying = false;
    updatePlayPauseButton(false);
    emitSyncAction('pause', { currentTime: state.ytPlayer.getCurrentTime() });
  }
}

// ==================== DRM STREAMING COMPANION (NETFLIX, PRIME, JIOHOTSTAR, ZEE5) ====================
function openStreamingCompanion(serviceName) {
  state.room.media = {
    type: 'stream_companion',
    title: `${serviceName} Sync Companion`,
    companionService: serviceName
  };
  setMediaSource(state.room.media, true);
  closeMediaModal();
  openCountdownModal(serviceName);
}

function openCountdownModal(serviceName) {
  const modal = document.getElementById('countdownModal');
  const numberEl = document.getElementById('countdownNumber');
  const serviceEl = document.getElementById('countdownService');
  
  if (!modal || !numberEl) return;
  serviceEl.textContent = serviceName;
  modal.classList.remove('hidden');

  let count = 3;
  numberEl.textContent = count;
  numberEl.className = 'text-7xl font-extrabold text-red-500 animate-countdown';

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      numberEl.textContent = count;
      numberEl.className = 'text-7xl font-extrabold text-red-500 animate-countdown';
    } else if (count === 0) {
      numberEl.textContent = 'PLAY NOW!';
      numberEl.className = 'text-5xl font-extrabold text-emerald-400 animate-pulse';
    } else {
      clearInterval(timer);
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 1500);
    }
  }, 1000);
}

// ==================== WHATSAPP & SCANNABLE QR CODE MODAL ====================
function getValidShareUrl(roomId) {
  const code = roomId || state.room.id || 'AB7K9';
  let origin = window.location.origin;

  // If running on localhost on host PC, replace with active Wi-Fi LAN IP so mobile devices can access directly
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    origin = 'http://10.53.50.251:3001';
  }

  return `${origin}?room=${code}`;
}

function openInviteModal() {
  const modal = document.getElementById('inviteModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const roomId = state.room.id || 'AB7K9';
  document.getElementById('modalRoomCode').textContent = roomId;

  // Compute Valid Original Share Link
  const joinUrl = getValidShareUrl(roomId);
  const linkInput = document.getElementById('joinLinkInput');
  if (linkInput) linkInput.value = joinUrl;

  // Render High-Res QR Code (300x300)
  const qrContainer = document.getElementById('qrCodeContainer');
  if (qrContainer) {
    qrContainer.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: joinUrl,
        width: 190,
        height: 190,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}" class="rounded-lg shadow" />`;
    }
  }
}

function closeInviteModal() {
  document.getElementById('inviteModal')?.classList.add('hidden');
}

function shareToWhatsApp() {
  const roomId = state.room.id || 'AB7K9';
  const joinUrl = document.getElementById('joinLinkInput')?.value || getValidShareUrl(roomId);
  const message = `🎬 *Watch Together on The Between Us!*\n\nHey! Join my private 2-person cinema room on *The Between Us* by *Hasatz Solutions Private Limited*.\n\n🔑 *Room Code:* ${roomId}\n🔗 *Original Join Link:* ${joinUrl}\n\nTap the link above to start watching together in real-time sync! ❤️🍿`;
  
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

function copyJoinLink() {
  const linkInput = document.getElementById('joinLinkInput');
  if (linkInput) {
    linkInput.select();
    navigator.clipboard.writeText(linkInput.value);
    showToast('Valid WhatsApp join link copied! 📋');
  }
}

function copyRoomCode() {
  const roomId = state.room.id || 'AB7K9';
  navigator.clipboard.writeText(roomId);
  showToast(`Room Code ${roomId} copied! 📋`);
}

function downloadQRCodePNG() {
  const qrImg = document.querySelector('#qrCodeContainer img') || document.querySelector('#qrCodeContainer canvas');
  if (!qrImg) return;

  const a = document.createElement('a');
  a.download = `TheBetweenUs_Invite_${state.room.id || 'Code'}.png`;
  a.href = qrImg.src || qrImg.toDataURL?.('image/png');
  a.click();
  showToast('QR Code PNG downloaded! 📥');
}

// ==================== LIVE CHAT & OFFLINE NOTES ====================
function toggleChatDrawer() {
  const drawer = document.getElementById('chatDrawer');
  state.isChatOpen = !state.isChatOpen;
  drawer?.classList.toggle('translate-x-full', !state.isChatOpen);
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input?.value?.trim();
  if (!text) return;

  const message = {
    id: 'msg_' + Date.now(),
    userId: state.user.id,
    senderName: state.user.name,
    avatar: state.user.avatar,
    avatarUrl: state.user.avatarUrl,
    text: text,
    timestamp: Date.now(),
    videoTime: getCurrentPlaybackTime()
  };

  input.value = '';
  appendChatMessage(message);

  if (state.socket && state.socketConnected && state.room.id && !state.room.isOffline) {
    state.socket.emit('chat:send', message);
  } else {
    // Save to Offline Notes
    saveOfflineNote(message);
  }
}

function appendChatMessage(msg) {
  const container = document.getElementById('chatMessagesList');
  if (!container) return;

  const isSelf = msg.userId === state.user.id;
  const timeFormatted = formatTime(msg.videoTime || 0);

  const bubble = document.createElement('div');
  bubble.className = `flex flex-col ${isSelf ? 'items-end' : 'items-start'} mb-2.5`;
  bubble.innerHTML = `
    <div class="flex items-center gap-1.5 mb-0.5 text-[10px] text-gray-400">
      <span class="font-medium text-gray-300">${escapeHtml(msg.senderName)}</span>
      <span class="text-gray-500 font-mono">${timeFormatted}</span>
    </div>
    <div class="max-w-[85%] px-3 py-1.5 text-xs ${
      isSelf ? 'chat-bubble-self' : 'chat-bubble-partner'
    }">
      ${escapeHtml(msg.text)}
    </div>
  `;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function saveOfflineNote(msg) {
  const key = `wr_notes_${state.room.media.title || 'offline'}`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.push(msg);
  localStorage.setItem(key, JSON.stringify(existing));
}

function loadOfflineNotes() {
  const key = `wr_notes_${state.room.media.title || 'offline'}`;
  const notes = JSON.parse(localStorage.getItem(key) || '[]');
  const container = document.getElementById('chatMessagesList');
  if (container && notes.length > 0) {
    notes.forEach(msg => appendChatMessage(msg));
  }
}

// ==================== REAL-TIME REACTIONS ====================
function triggerReaction(emoji) {
  showToast(`${state.user.name}: ${emoji}`);

  if (state.socket && state.socketConnected && state.room.id && !state.room.isOffline) {
    state.socket.emit('sync:reaction', { emoji });
  }
}

// ==================== MODALS & HELPERS ====================
function openProfileModal() {
  document.getElementById('profileModal')?.classList.remove('hidden');
  document.getElementById('inputProfileName').value = state.user.name;
  document.getElementById('inputProfileEmail').value = state.user.email || '';
  renderAvatarPicker();
}

function closeProfileModal() {
  document.getElementById('profileModal')?.classList.add('hidden');
}

function renderAvatarPicker() {
  const container = document.getElementById('avatarPickerGrid');
  if (!container) return;

  container.innerHTML = CINEMA_AVATARS.map(av => `
    <button type="button" onclick="selectAvatar('${av}')" class="text-2xl p-2 rounded-xl hover:bg-white/10 transition ${state.user.avatar === av ? 'bg-red-600/30 border border-red-500' : ''}">
      ${av}
    </button>
  `).join('');
}

function selectAvatar(emoji) {
  state.user.avatar = emoji;
  state.user.avatarUrl = '';
  renderAvatarPicker();
}

function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.user.avatarUrl = e.target.result;
    state.user.avatar = '';
    updateProfileUI();
    showToast('Photo uploaded successfully! 📸');
  };
  reader.readAsDataURL(file);
}

function saveProfileChanges() {
  const name = document.getElementById('inputProfileName')?.value?.trim();
  const email = document.getElementById('inputProfileEmail')?.value?.trim();

  if (name) state.user.name = name;
  if (email) {
    state.user.email = email;
    state.user.authProvider = email.toLowerCase().includes('@gmail.com') ? 'google' : 'guest';
  }

  saveUserProfile();
  updateProfileUI();
  closeProfileModal();
  showToast('Profile updated! ✨');
}

function openMediaModal() {
  document.getElementById('mediaModal')?.classList.remove('hidden');
}

function closeMediaModal() {
  document.getElementById('mediaModal')?.classList.add('hidden');
}

function switchMediaTab(tabName) {
  document.querySelectorAll('.media-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.media-tab-btn').forEach(el => el.classList.remove('border-red-500', 'text-red-400'));

  document.getElementById(`mediaTab_${tabName}`)?.classList.remove('hidden');
  document.getElementById(`tabBtn_${tabName}`)?.classList.add('border-red-500', 'text-red-400');
}

function showToast(msg) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW Registration skipped:', err);
    });
  }
}
