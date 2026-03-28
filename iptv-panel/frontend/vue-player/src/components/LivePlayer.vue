<template>
  <div class="live-player" :class="{ fullscreen: isFullscreen }">
    <!-- Video Container -->
    <div class="video-wrapper" @click="togglePlayPause" @dblclick="toggleFullscreen" @mousemove="showControls">
      <video
        ref="videoEl"
        class="video-element"
        :autoplay="true"
        :muted="isMuted"
        playsinline
        @playing="onPlaying"
        @waiting="onWaiting"
        @error="onError"
        @timeupdate="onTimeUpdate"
        @volumechange="onVolumeChange"
      />

      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <p class="loading-text">{{ loadingText }}</p>
      </div>

      <!-- Error overlay -->
      <div v-if="error" class="error-overlay">
        <div class="error-icon">⚠️</div>
        <p class="error-text">{{ error }}</p>
        <button class="retry-btn" @click.stop="retryStream">Retry</button>
      </div>

      <!-- Channel info overlay -->
      <transition name="fade">
        <div v-if="showChannelInfo && currentChannel" class="channel-info-overlay">
          <img v-if="currentChannel.stream_icon" :src="currentChannel.stream_icon"
            class="channel-logo" @error="($event.target as HTMLImageElement).style.display='none'" />
          <div class="channel-details">
            <p class="channel-name">{{ currentChannel.name }}</p>
            <p v-if="currentEpg" class="channel-epg">
              {{ currentEpg.title }}
              <span class="epg-time">
                {{ formatTime(currentEpg.start) }} – {{ formatTime(currentEpg.end) }}
              </span>
            </p>
          </div>
        </div>
      </transition>

      <!-- Controls -->
      <transition name="fade">
        <div v-if="controlsVisible" class="controls-overlay" @click.stop>
          <!-- Progress bar (live indicator) -->
          <div class="live-badge">
            <span class="live-dot" />
            LIVE
          </div>

          <!-- Bottom controls -->
          <div class="controls-bottom">
            <!-- Left controls -->
            <div class="controls-left">
              <button class="ctrl-btn" @click="togglePlayPause" :title="isPlaying ? 'Pause' : 'Play'">
                <span v-if="isPlaying">⏸</span>
                <span v-else>▶</span>
              </button>
              <button class="ctrl-btn" @click="toggleMute" :title="isMuted ? 'Unmute' : 'Mute'">
                <span v-if="isMuted || volume === 0">🔇</span>
                <span v-else-if="volume < 0.5">🔉</span>
                <span v-else>🔊</span>
              </button>
              <input
                type="range"
                class="volume-slider"
                min="0"
                max="1"
                step="0.05"
                :value="isMuted ? 0 : volume"
                @input="onVolumeSlider"
                @click.stop
              />
            </div>

            <!-- Center: Channel name -->
            <div class="controls-center">
              <p class="ctrl-channel-name">{{ currentChannel?.name || 'No Channel' }}</p>
            </div>

            <!-- Right controls -->
            <div class="controls-right">
              <select v-if="availableQualities.length > 1" class="quality-select" @change="onQualityChange" @click.stop>
                <option v-for="q in availableQualities" :key="q.id" :value="q.id">{{ q.label }}</option>
              </select>
              <button class="ctrl-btn" @click="toggleFullscreen" title="Fullscreen">
                <span v-if="isFullscreen">⛶</span>
                <span v-else>⛶</span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import Hls from 'hls.js';
import dayjs from 'dayjs';

interface Channel {
  id: number;
  name: string;
  stream_icon?: string;
  direct_source: string;
  epg_channel_id?: string;
}

interface EpgProgram {
  title: string;
  description?: string;
  start: string;
  end: string;
}

const props = defineProps<{
  channel?: Channel;
  credentials?: { username: string; password: string };
  baseUrl?: string;
}>();

const emit = defineEmits<{
  error: [err: string];
  playing: [];
  channelChange: [channel: Channel];
}>();

const videoEl = ref<HTMLVideoElement>();
const isPlaying = ref(false);
const isLoading = ref(false);
const isMuted = ref(false);
const volume = ref(1);
const error = ref('');
const isFullscreen = ref(false);
const controlsVisible = ref(true);
const showChannelInfo = ref(false);
const loadingText = ref('Loading...');
const currentEpg = ref<EpgProgram | null>(null);
const availableQualities = ref<{ id: number; label: string }[]>([]);
const currentQuality = ref(-1); // -1 = auto

let hls: Hls | null = null;
let controlsTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
const maxRetries = 3;

const currentChannel = computed(() => props.channel);

function buildStreamUrl(channel: Channel): string {
  if (props.credentials && props.baseUrl) {
    const { username, password } = props.credentials;
    const ext = 'm3u8'; // HLS
    return `${props.baseUrl}/live/${username}/${password}/${channel.id}.${ext}`;
  }
  return channel.direct_source;
}

function initHls(url: string) {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  if (!videoEl.value) return;

  isLoading.value = true;
  error.value = '';
  loadingText.value = 'Connecting...';

  if (Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      maxBufferLength: 30,
      maxMaxBufferLength: 120,
      maxBufferSize: 60 * 1024 * 1024,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 3,
      levelLoadingTimeOut: 10000
    });

    hls.loadSource(url);
    hls.attachMedia(videoEl.value);

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      loadingText.value = 'Buffering...';
      videoEl.value?.play().catch(() => {
        isMuted.value = true;
        videoEl.value?.play();
      });

      // Build quality options
      availableQualities.value = [
        { id: -1, label: 'Auto' },
        ...data.levels.map((l, i) => ({
          id: i,
          label: l.height ? `${l.height}p` : `Level ${i + 1}`
        }))
      ];
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (retryCount < maxRetries) {
              retryCount++;
              loadingText.value = `Reconnecting (${retryCount}/${maxRetries})...`;
              setTimeout(() => hls?.startLoad(), 2000);
            } else {
              error.value = 'Stream unavailable. Please try again.';
              isLoading.value = false;
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls?.recoverMediaError();
            break;
          default:
            error.value = 'Playback error occurred';
            isLoading.value = false;
        }
      }
    });

  } else if (videoEl.value.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoEl.value.src = url;
    videoEl.value.play().catch(() => {
      isMuted.value = true;
      videoEl.value?.play();
    });
  } else {
    // Fallback: direct TS/MP4
    videoEl.value.src = url;
    videoEl.value.play().catch(() => {});
  }
}

function onPlaying() {
  isPlaying.value = true;
  isLoading.value = false;
  error.value = '';
  retryCount = 0;

  // Show channel info briefly
  showChannelInfo.value = true;
  setTimeout(() => { showChannelInfo.value = false; }, 4000);

  emit('playing');
}

function onWaiting() {
  isLoading.value = true;
  loadingText.value = 'Buffering...';
}

function onError() {
  error.value = 'Stream error occurred';
  isLoading.value = false;
}

function onTimeUpdate() {
  if (videoEl.value) {
    isPlaying.value = !videoEl.value.paused;
  }
}

function onVolumeChange() {
  if (videoEl.value) {
    volume.value = videoEl.value.volume;
    isMuted.value = videoEl.value.muted;
  }
}

function togglePlayPause() {
  if (!videoEl.value) return;
  if (videoEl.value.paused) {
    videoEl.value.play();
  } else {
    videoEl.value.pause();
    isPlaying.value = false;
  }
}

function toggleMute() {
  if (!videoEl.value) return;
  isMuted.value = !isMuted.value;
  videoEl.value.muted = isMuted.value;
}

function onVolumeSlider(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (videoEl.value) {
    videoEl.value.volume = val;
    videoEl.value.muted = val === 0;
    volume.value = val;
    isMuted.value = val === 0;
  }
}

function onQualityChange(e: Event) {
  const level = parseInt((e.target as HTMLSelectElement).value);
  if (hls) {
    hls.currentLevel = level;
    currentQuality.value = level;
  }
}

function toggleFullscreen() {
  const el = videoEl.value?.parentElement;
  if (!el) return;

  if (!document.fullscreenElement) {
    el.requestFullscreen?.().then(() => { isFullscreen.value = true; });
  } else {
    document.exitFullscreen?.().then(() => { isFullscreen.value = false; });
  }
}

function retryStream() {
  retryCount = 0;
  if (currentChannel.value) {
    initHls(buildStreamUrl(currentChannel.value));
  }
}

function showControls() {
  controlsVisible.value = true;
  if (controlsTimer) clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => {
    controlsVisible.value = false;
  }, 3000);
}

function formatTime(timeStr: string) {
  return dayjs(timeStr).format('HH:mm');
}

watch(() => props.channel, (channel) => {
  if (channel) {
    retryCount = 0;
    initHls(buildStreamUrl(channel));
    showChannelInfo.value = true;
    setTimeout(() => { showChannelInfo.value = false; }, 4000);
  }
}, { immediate: true });

onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement;
  });
  showControls();
});

onUnmounted(() => {
  if (hls) { hls.destroy(); }
  if (controlsTimer) clearTimeout(controlsTimer);
});
</script>

<style scoped>
.live-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  user-select: none;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.loading-overlay, .error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  gap: 12px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text { font-size: 0.875rem; color: rgba(255,255,255,0.8); }
.error-icon { font-size: 2rem; }
.error-text { font-size: 0.875rem; color: rgba(255,255,255,0.8); text-align: center; padding: 0 1rem; }
.retry-btn {
  padding: 0.5rem 1.5rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}
.retry-btn:hover { background: #4f46e5; }

.channel-info-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  padding: 12px 16px;
  border-radius: 10px;
  max-width: 400px;
}
.channel-logo { width: 40px; height: 40px; object-fit: contain; border-radius: 4px; }
.channel-name { font-size: 1rem; font-weight: 600; color: white; }
.channel-epg { font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-top: 2px; }
.epg-time { font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-left: 6px; }

.controls-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 12px 12px;
}

.live-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ef4444;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.live-dot { width: 6px; height: 6px; background: white; border-radius: 50%; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.controls-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}
.controls-left, .controls-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.controls-center { flex: 1; text-align: center; }
.ctrl-channel-name { font-size: 0.875rem; color: white; font-weight: 500; }

.ctrl-btn {
  background: rgba(255,255,255,0.1);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.ctrl-btn:hover { background: rgba(255,255,255,0.2); }

.volume-slider {
  width: 80px;
  accent-color: #6366f1;
  cursor: pointer;
}

.quality-select {
  background: rgba(255,255,255,0.1);
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}
.quality-select option { background: #1f2937; color: white; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fullscreen .video-wrapper { border-radius: 0; }
</style>
