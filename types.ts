export type NetworkQuality = 'excellent' | 'good' | 'weak' | 'offline';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  avatarUrl?: string;
  authProvider: 'google' | 'guest';
}

export interface Participant {
  id: string; // Socket id
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  email?: string;
  authProvider?: 'google' | 'guest';
  joinedAt: number;
  isReady: boolean;
  isBuffering: boolean;
  playbackTime: number;
  isPlaying: boolean;
  networkQuality: 'excellent' | 'good' | 'weak';
  latency: number;
}

export type MediaSourceType = 'direct' | 'local' | 'youtube' | 'stream_companion';

export interface MediaSourceState {
  type: MediaSourceType;
  title: string;
  url?: string;
  youtubeId?: string;
  fileName?: string;
  fileSize?: number;
  fileBlobUrl?: string;
  duration?: number;
  poster?: string;
  companionService?: 'jiohotstar' | 'zee5' | 'netflix' | 'prime' | 'other';
  externalAppUrl?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  playbackRate: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  userId: string;
  senderName: string;
  avatar: string;
  avatarUrl?: string;
  text: string;
  timestamp: number;
}

export interface ReactionBurst {
  id: string;
  emoji: string;
  senderName: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface FileTransferProgress {
  isTransferring: boolean;
  isSender: boolean;
  fileName: string;
  fileSize: number;
  bytesTransferred: number;
  progressPercent: number;
  speedBps: number;
  etaSeconds: number;
  status: 'idle' | 'requesting_permission' | 'connecting' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
}

export interface DataSaverSettings {
  enabled: boolean;
  maxQuality: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' | 'auto';
  disableReactions: boolean;
  lowFrequencyHeartbeat: boolean;
  reduceMotion: boolean;
}
