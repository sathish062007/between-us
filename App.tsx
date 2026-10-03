import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film,
  Youtube,
  Tv,
  FolderOpen,
  Share2,
  Sparkles,
  Info,
  Shield,
  Smartphone,
  Zap,
  HardDrive,
  WifiOff,
  Video,
} from 'lucide-react';
import {
  Participant,
  MediaSourceState,
  PlaybackState,
  ChatMessage,
  ReactionBurst,
  FileTransferProgress,
  DataSaverSettings as DataSaverType,
  NetworkQuality,
  UserProfile,
} from './types';
import { socketService } from './services/socket';
import { webrtcService } from './services/webrtc';
import { authService } from './services/auth';
import { Header } from './components/Header';
import { TwoPersonStatus } from './components/TwoPersonStatus';
import { RoomLobby } from './components/RoomLobby';
import { VideoPlayer } from './components/VideoPlayer';
import { SourceSelector } from './components/SourceSelector';
import { LocalP2PTransferModal } from './components/LocalP2PTransferModal';
import { StreamingHubModal } from './components/StreamingHubModal';
import { ChatOverlay } from './components/ChatOverlay';
import { ReactionFloating } from './components/ReactionFloating';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { ConnectionBanner, AlertNotification } from './components/ConnectionBanner';
import { DataSaverSettingsModal } from './components/DataSaverSettings';
import { InviteShareModal } from './components/InviteShareModal';
import { UserProfileModal } from './components/UserProfileModal';

export const App: React.FC = () => {
  // Auth & Profile State
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => authService.getCurrentUser());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Offline Mode State
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Room State
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selfUser, setSelfUser] = useState<Participant | null>(null);
  const [currentMedia, setCurrentMedia] = useState<MediaSourceState>({
    type: 'direct',
    title: 'Sintel - Open Cinema Movie (Sample)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: 52,
    poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
  });

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetSeekTime, setTargetSeekTime] = useState<number | null>(null);
  const [remoteSyncNotice, setRemoteSyncNotice] = useState<string | null>(null);
  const [driftSeconds, setDriftSeconds] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Network & Latency
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>(navigator.onLine ? 'excellent' : 'offline');
  const [latency, setLatency] = useState(24);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | undefined>(undefined);

  // Data Saver
  const [dataSaver, setDataSaver] = useState<DataSaverType>({
    enabled: false,
    maxQuality: 'auto',
    disableReactions: false,
    lowFrequencyHeartbeat: false,
    reduceMotion: false,
  });

  // Chat & Reactions
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionBurst[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Modals
  const [isSourceSelectorOpen, setIsSourceSelectorOpen] = useState(false);
  const [isDataSaverModalOpen, setIsDataSaverModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isStreamingHubOpen, setIsStreamingHubOpen] = useState(false);
  const [selectedStreamingService, setSelectedStreamingService] = useState<'jiohotstar' | 'zee5' | 'netflix' | 'prime' | null>(null);
  const [streamingCountdown, setStreamingCountdown] = useState<number | null>(null);

  // P2P File Sharing state
  const [fileTransferProgress, setFileTransferProgress] = useState<FileTransferProgress>({
    isTransferring: false,
    isSender: false,
    fileName: '',
    fileSize: 0,
    bytesTransferred: 0,
    progressPercent: 0,
    speedBps: 0,
    etaSeconds: 0,
    status: 'idle',
  });
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [p2pRequesterInfo, setP2pRequesterInfo] = useState<{ fileName: string; fileSize: number; senderName: string } | null>(null);

  // Banner Notifications
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  const isLocalActionRef = useRef(false);

  const addNotification = (notif: Omit<AlertNotification, 'id'>) => {
    const id = `notif_${Date.now()}_${Math.random()}`;
    setNotifications((prev) => [...prev, { ...notif, id }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Load offline movie notes when changing media
  useEffect(() => {
    if (isOfflineMode && currentMedia.title) {
      try {
        const savedNotes = localStorage.getItem(`wr_notes_${currentMedia.title}`);
        if (savedNotes) {
          setMessages(JSON.parse(savedNotes));
        } else {
          setMessages([
            {
              id: `welcome_${Date.now()}`,
              senderId: 'system',
              userId: 'system',
              senderName: 'Offline Cinema',
              avatar: '🎬',
              text: `Offline Chat & Notes active for "${currentMedia.title}". Your thoughts and reactions are saved locally!`,
              timestamp: Date.now(),
            },
          ]);
        }
      } catch (_) {}
    }
  }, [isOfflineMode, currentMedia.title]);

  // Browser online/offline listener
  useEffect(() => {
    const handleOnline = () => {
      setNetworkQuality('good');
      addNotification({
        type: 'success',
        title: 'Online',
        message: 'Internet connection restored.',
      });
    };

    const handleOffline = () => {
      setNetworkQuality('offline');
      addNotification({
        type: 'warning',
        title: 'Offline Mode Active',
        message: 'You can continue playing local phone videos and using chat/notes offline.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [initialInviteCode, setInitialInviteCode] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialInviteCode(roomParam.toUpperCase());
    }
  }, []);

  // Socket and WebRTC listeners setup
  useEffect(() => {
    socketService.onConnect = () => {
      setNetworkQuality('excellent');
    };

    socketService.onDisconnect = () => {
      setNetworkQuality('offline');
    };

    socketService.onReconnect = () => {
      setNetworkQuality('good');
    };

    socketService.onLatencyUpdate = (lat) => {
      setLatency(lat);
      if (lat > 200) {
        setNetworkQuality('weak');
        if (!dataSaver.enabled) {
          setDataSaver((prev) => ({ ...prev, enabled: true }));
        }
      } else if (lat > 90) {
        setNetworkQuality('good');
      } else {
        setNetworkQuality('excellent');
      }
    };

    socketService.onRoomUpdated = (data) => {
      setRoomId(data.roomId);
      setParticipants(data.participants);
      const me = data.participants.find((p) => p.userId === currentUser.id);
      if (me) setSelfUser(me);
      if (data.currentMedia && !isOfflineMode) setCurrentMedia(data.currentMedia);
    };

    // Playback sync events
    socketService.onPlay = (data) => {
      if (isLocalActionRef.current || isOfflineMode) return;
      setIsPlaying(true);
      setTargetSeekTime(data.currentTime);
      setRemoteSyncNotice(`${data.senderName} resumed`);
      setTimeout(() => setRemoteSyncNotice(null), 2500);
    };

    socketService.onPause = (data) => {
      if (isLocalActionRef.current || isOfflineMode) return;
      setIsPlaying(false);
      setTargetSeekTime(data.currentTime);
      setRemoteSyncNotice(`${data.senderName} paused`);
      setTimeout(() => setRemoteSyncNotice(null), 2500);
    };

    socketService.onSeek = (data) => {
      if (isLocalActionRef.current || isOfflineMode) return;
      setIsSeeking(true);
      setTargetSeekTime(data.targetTime);
      if (typeof data.isPlaying === 'boolean') {
        setIsPlaying(data.isPlaying);
      }
      setRemoteSyncNotice(`${data.senderName} seeked`);
      setTimeout(() => {
        setIsSeeking(false);
        setRemoteSyncNotice(null);
      }, 2000);
    };

    socketService.onMediaChanged = (data) => {
      if (isOfflineMode) return;
      setCurrentMedia(data.media);
      setIsPlaying(false);
      setTargetSeekTime(0);
      addNotification({
        type: 'info',
        title: 'Video Changed',
        message: `${data.senderName} selected: ${data.media.title}`,
      });
    };

    socketService.onPeerStatus = (data) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.peerId ? { ...p, latency: data.latency, isPlaying: data.isPlaying } : p))
      );
    };

    socketService.onPeerBuffering = (data) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.peerId ? { ...p, isBuffering: data.isBuffering } : p))
      );
    };

    socketService.onChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    };

    socketService.onReactionBurst = (reaction) => {
      const newReaction: ReactionBurst = {
        id: `react_${Date.now()}_${Math.random()}`,
        emoji: reaction.emoji,
        senderName: reaction.senderName,
        x: reaction.x || 50,
        y: reaction.y || 50,
        timestamp: Date.now(),
      };
      setReactions((prev) => [...prev, newReaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
      }, 2000);
    };

    socketService.onSystemNotification = (notif) => {
      addNotification({
        type: 'info',
        title: notif.type === 'user_joined' ? 'Friend Joined' : 'Partner Update',
        message: notif.message,
      });
    };

    // WebRTC File Transfer hooks
    webrtcService.onPermissionRequested = (meta) => {
      setP2pRequesterInfo(meta);
      setIsTransferModalOpen(true);
      setFileTransferProgress({
        isTransferring: true,
        isSender: false,
        fileName: meta.fileName,
        fileSize: meta.fileSize,
        bytesTransferred: 0,
        progressPercent: 0,
        speedBps: 0,
        etaSeconds: 0,
        status: 'requesting_permission',
      });
    };

    webrtcService.onProgress = (progress) => {
      setFileTransferProgress(progress);
      if (progress.isTransferring && !isTransferModalOpen) {
        setIsTransferModalOpen(true);
      }
    };

    webrtcService.onFileReceived = (blob, fileName) => {
      const blobUrl = URL.createObjectURL(blob);
      setCurrentMedia({
        type: 'local',
        title: fileName,
        fileName: fileName,
        fileSize: blob.size,
        fileBlobUrl: blobUrl,
      });
      addNotification({
        type: 'success',
        title: 'Movie Ready!',
        message: `${fileName} received directly via P2P. Ready to watch together!`,
      });
    };

    webrtcService.onError = (err) => {
      addNotification({
        type: 'error',
        title: 'P2P Transfer Error',
        message: err,
      });
    };
  }, [currentUser.id, isChatOpen, isOfflineMode, dataSaver.enabled]);

  // Auth Handlers
  const handleGoogleSignIn = (account: { name: string; email: string; avatarUrl?: string }) => {
    const updated = authService.signInWithRealGoogle(account);
    setCurrentUser(updated);
    addNotification({
      type: 'success',
      title: 'Signed In with Google',
      message: `Welcome, ${updated.name}!`,
    });
  };

  const handleSignOut = () => {
    const guest = authService.signOut();
    setCurrentUser(guest);
    addNotification({
      type: 'info',
      title: 'Signed Out',
      message: 'Switched to Guest Mode.',
    });
  };

  const handleSaveProfile = (name: string, avatar: string, avatarUrl?: string) => {
    const updated = authService.updateProfile(name, avatar, avatarUrl);
    setCurrentUser(updated);
    addNotification({
      type: 'success',
      title: 'Profile Saved',
      message: `Your name is now ${updated.name}.`,
    });
  };

  // Direct Offline Local Play Launch
  const handleStartOfflineLocalPlay = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setCurrentMedia({
      type: 'local',
      title: file.name,
      fileName: file.name,
      fileSize: file.size,
      fileBlobUrl: blobUrl,
    });
    setIsOfflineMode(true);
    setIsPlaying(false);
    addNotification({
      type: 'success',
      title: 'Offline Theater Active',
      message: `Playing "${file.name}" locally. Chat, emoji reactions & notes active offline!`,
    });
  };

  // Handle Room Actions
  const handleCreateRoom = (userName: string, avatar: string, avatarUrl?: string) => {
    setIsOfflineMode(false);
    setIsConnecting(true);
    setLobbyError(undefined);

    socketService.joinRoom(
      {
        userId: currentUser.id,
        userName,
        userAvatar: avatar,
        userAvatarUrl: avatarUrl || currentUser.avatarUrl,
        email: currentUser.email,
        authProvider: currentUser.authProvider,
      },
      (res) => {
        setIsConnecting(false);
        if (res.success && res.roomId) {
          setRoomId(res.roomId);
          if (res.participants) setParticipants(res.participants);
          if (res.currentMedia) setCurrentMedia(res.currentMedia);
          const me = res.participants?.find((p) => p.userId === currentUser.id);
          if (me) setSelfUser(me);
          window.history.replaceState({}, '', `?room=${res.roomId}`);
        } else {
          setLobbyError(res.error || 'Failed to create room.');
        }
      }
    );
  };

  const handleJoinRoom = (targetRoomId: string, userName: string, avatar: string, avatarUrl?: string) => {
    setIsOfflineMode(false);
    setIsConnecting(true);
    setLobbyError(undefined);

    socketService.joinRoom(
      {
        roomId: targetRoomId,
        userId: currentUser.id,
        userName,
        userAvatar: avatar,
        userAvatarUrl: avatarUrl || currentUser.avatarUrl,
        email: currentUser.email,
        authProvider: currentUser.authProvider,
      },
      (res) => {
        setIsConnecting(false);
        if (res.success && res.roomId) {
          setRoomId(res.roomId);
          if (res.participants) setParticipants(res.participants);
          if (res.currentMedia) setCurrentMedia(res.currentMedia);
          const me = res.participants?.find((p) => p.userId === currentUser.id);
          if (me) setSelfUser(me);
          window.history.replaceState({}, '', `?room=${res.roomId}`);
        } else {
          setLobbyError(res.error || 'Failed to join room.');
        }
      }
    );
  };

  const handleLeaveRoom = () => {
    if (!isOfflineMode) {
      socketService.leaveRoom();
    }
    setIsOfflineMode(false);
    setRoomId(null);
    setParticipants([]);
    setSelfUser(null);
    setMessages([]);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Video Playback Handlers
  const handleSyncPlay = (currentTime: number) => {
    setIsPlaying(true);
    if (!isOfflineMode && roomId) {
      isLocalActionRef.current = true;
      const actionId = `act_${Date.now()}`;
      socketService.emitPlay(currentTime, actionId);
      setTimeout(() => { isLocalActionRef.current = false; }, 300);
    }
  };

  const handleSyncPause = (currentTime: number) => {
    setIsPlaying(false);
    if (!isOfflineMode && roomId) {
      isLocalActionRef.current = true;
      const actionId = `act_${Date.now()}`;
      socketService.emitPause(currentTime, actionId);
      setTimeout(() => { isLocalActionRef.current = false; }, 300);
    }
  };

  const handleSyncSeek = (targetTime: number) => {
    setTargetSeekTime(targetTime);
    if (!isOfflineMode && roomId) {
      isLocalActionRef.current = true;
      const actionId = `act_${Date.now()}`;
      socketService.emitSeek(targetTime, isPlaying, actionId);
      setTimeout(() => { isLocalActionRef.current = false; }, 300);
    }
  };

  const handleSyncHeartbeat = useCallback((time: number, playing: boolean) => {
    if (!isOfflineMode && roomId) {
      socketService.emitHeartbeat(time, playing);
    }
  }, [isOfflineMode, roomId]);

  const handleSyncBuffering = useCallback((buffering: boolean) => {
    if (!isOfflineMode && roomId) {
      socketService.emitBuffering(buffering);
    }
  }, [isOfflineMode, roomId]);

  const handleSelectMedia = (media: MediaSourceState) => {
    setCurrentMedia(media);
    if (!isOfflineMode && roomId) {
      socketService.emitMediaChange(media);
    }
  };

  const handleSelectLocalFileForP2P = (file: File) => {
    const friend = participants.find((p) => p.id !== selfUser?.id);
    if (friend && !isOfflineMode) {
      webrtcService.initiateFileSend(file, friend.id, selfUser?.name || currentUser.name);
      setIsTransferModalOpen(true);
    }
  };

  const handleAcceptP2P = () => {
    if (!p2pRequesterInfo) return;
    const friend = participants.find((p) => p.id !== selfUser?.id);
    if (friend) {
      webrtcService.acceptIncomingTransfer(friend.id, p2pRequesterInfo);
    }
  };

  const handleDeclineP2P = () => {
    const friend = participants.find((p) => p.id !== selfUser?.id);
    if (friend) {
      webrtcService.declineTransfer(friend.id);
    }
    setIsTransferModalOpen(false);
  };

  const handleCancelP2P = () => {
    webrtcService.cancelTransfer();
    setIsTransferModalOpen(false);
  };

  const handleStartStreamingCountdown = () => {
    let count = 3;
    setStreamingCountdown(count);
    const timer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        setStreamingCountdown(0);
        clearInterval(timer);
        setTimeout(() => setStreamingCountdown(null), 3000);
      } else {
        setStreamingCountdown(count);
      }
    }, 1000);
  };

  // Chat & Reaction Handlers (Works Online and Offline!)
  const handleSendMessage = (text: string) => {
    if (isOfflineMode || !socketService.isConnected()) {
      // Offline local message / note
      const offlineMsg: ChatMessage = {
        id: `offline_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: currentUser.id,
        userId: currentUser.id,
        senderName: currentUser.name,
        avatar: currentUser.avatar,
        avatarUrl: currentUser.avatarUrl,
        text: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, offlineMsg];
        try {
          localStorage.setItem(`wr_notes_${currentMedia.title}`, JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    } else {
      socketService.emitChat(text);
    }
  };

  const handleSendReaction = (emoji: string) => {
    const burst: ReactionBurst = {
      id: `react_${Date.now()}_${Math.random()}`,
      emoji: emoji,
      senderName: currentUser.name,
      x: 30 + Math.random() * 40,
      y: 50,
      timestamp: Date.now(),
    };
    setReactions((prev) => [...prev, burst]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== burst.id));
    }, 2000);

    if (!isOfflineMode && socketService.isConnected()) {
      socketService.emitReaction(emoji, burst.x, burst.y);
    }
  };

  const friend = participants.find((p) => p.id !== selfUser?.id);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-cinema-950 text-slate-100 relative">
      {/* Top App Header */}
      <Header
        roomId={roomId}
        isOfflineMode={isOfflineMode}
        participants={participants}
        selfUser={selfUser}
        currentUser={currentUser}
        networkQuality={networkQuality}
        latency={latency}
        dataSaver={dataSaver}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenDataSaver={() => setIsDataSaverModalOpen(true)}
        onOpenInvite={() => setIsInviteModalOpen(true)}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Floating System / Error Notifications */}
      <ConnectionBanner
        notifications={notifications}
        onDismiss={removeNotification}
      />

      {/* Main App Content View */}
      {!roomId && !isOfflineMode ? (
        /* Room Entry / Creation Lobby */
        <RoomLobby
          currentUser={currentUser}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onStartOfflineLocalPlay={handleStartOfflineLocalPlay}
          onGoogleSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          initialRoomId={initialInviteCode}
          isConnecting={isConnecting}
          errorMessage={lobbyError}
        />
      ) : (
        /* Active Video View (Online Room or Offline Local Player) */
        <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-2 space-y-2.5">
          {/* 1. Two-Person Presence Bar (Online mode only) */}
          {!isOfflineMode && (
            <TwoPersonStatus
              participants={participants}
              selfUser={selfUser}
              onInviteClick={() => setIsInviteModalOpen(true)}
            />
          )}

          {/* 2. Source Selector Action Bar */}
          <div className="w-full flex items-center justify-between gap-1.5 px-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* Select Movie Button */}
              <button
                onClick={() => setIsSourceSelectorOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-cinema-800 hover:bg-cinema-700 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isOfflineMode ? 'Switch Local Video' : 'Select Movie'}</span>
              </button>

              {!isOfflineMode && (
                <>
                  {/* YouTube Button */}
                  <button
                    onClick={() => setIsSourceSelectorOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-cinema-800 hover:bg-cinema-700 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
                  >
                    <Youtube className="w-3.5 h-3.5 text-red-400" />
                    <span>YouTube</span>
                  </button>

                  {/* Streaming Service Button */}
                  <button
                    onClick={() => {
                      setSelectedStreamingService('jiohotstar');
                      setIsStreamingHubOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cinema-800 hover:bg-cinema-700 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
                  >
                    <Tv className="w-3.5 h-3.5 text-pink-400" />
                    <span>Streaming Hub</span>
                  </button>
                </>
              )}
            </div>

            {/* Realtime Synced Badge or Offline Badge */}
            <div className="shrink-0">
              {isOfflineMode ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold select-none">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  <span>Offline Storage</span>
                </div>
              ) : (
                <SyncStatusBadge
                  isPartnerBuffering={!!friend?.isBuffering}
                  networkQuality={networkQuality}
                  isSeeking={isSeeking}
                  driftSeconds={driftSeconds}
                />
              )}
            </div>
          </div>

          {/* Current Video Title Tag */}
          <div className="px-1 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-bold text-slate-200 truncate">{currentMedia.title}</span>
            </div>
            {currentMedia.type === 'local' && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isOfflineMode ? 'Offline Local File' : 'Local Device'}
              </span>
            )}
          </div>

          {/* 3. Main Cinema Video Player */}
          <div className="w-full relative">
            <VideoPlayer
              media={currentMedia}
              isPlaying={isPlaying}
              onPlay={handleSyncPlay}
              onPause={handleSyncPause}
              onSeek={handleSyncSeek}
              onHeartbeat={handleSyncHeartbeat}
              onBuffering={handleSyncBuffering}
              targetSeekTime={targetSeekTime}
              remoteSyncNotice={remoteSyncNotice}
              dataSaver={dataSaver}
              onOpenSourceSelector={() => setIsSourceSelectorOpen(true)}
              onOpenDataSaver={() => setIsDataSaverModalOpen(true)}
            />

            {/* Floating Live Reaction Bursts (Works in both Online & Offline Mode) */}
            <ReactionFloating reactions={reactions} />
          </div>

          {/* 4. Chat & Quick Reactions Tray (Enabled in both Online & Offline Mode) */}
          <div className="mt-auto">
            <ChatOverlay
              messages={messages}
              currentUserId={currentUser.id}
              onSendMessage={handleSendMessage}
              onSendReaction={handleSendReaction}
              isOpen={isChatOpen}
              onToggleOpen={() => {
                setIsChatOpen((prev) => !prev);
                if (!isChatOpen) setUnreadChatCount(0);
              }}
              unreadCount={unreadChatCount}
            />
          </div>
        </main>
      )}

      {/* Modals */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onSaveProfile={handleSaveProfile}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
      />

      <SourceSelector
        isOpen={isSourceSelectorOpen}
        onClose={() => setIsSourceSelectorOpen(false)}
        onSelectMedia={handleSelectMedia}
        onSelectLocalFileForP2P={handleSelectLocalFileForP2P}
        onOpenStreamingHub={(service) => {
          setSelectedStreamingService(service);
          setIsStreamingHubOpen(true);
        }}
      />

      <LocalP2PTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        progress={fileTransferProgress}
        onAccept={handleAcceptP2P}
        onDecline={handleDeclineP2P}
        onCancel={handleCancelP2P}
        permissionRequesterName={p2pRequesterInfo?.senderName}
      />

      <StreamingHubModal
        isOpen={isStreamingHubOpen}
        service={selectedStreamingService}
        onClose={() => setIsStreamingHubOpen(false)}
        onStartSynchronizedCountdown={handleStartStreamingCountdown}
        countdownValue={streamingCountdown}
      />

      <DataSaverSettingsModal
        isOpen={isDataSaverModalOpen}
        onClose={() => setIsDataSaverModalOpen(false)}
        settings={dataSaver}
        networkQuality={networkQuality}
        latency={latency}
        onUpdateSettings={(newSettings) => setDataSaver((prev) => ({ ...prev, ...newSettings }))}
      />

      <InviteShareModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId || ''}
      />
    </div>
  );
};
