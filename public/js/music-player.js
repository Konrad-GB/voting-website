// Background Music Player
(function() {
  // Create music player HTML
  const playerHTML = `
    <div class="music-player" id="musicPlayer">
      <audio id="bgMusic" loop>
        <source src="/audio/background-music.mp3" type="audio/mpeg">
      </audio>
      <div class="music-controls">
        <button class="music-btn" id="playPauseBtn" title="Play/Pause">
          ▶️
        </button>
        <button class="music-btn" id="muteBtn" title="Mute/Unmute">
          🔊
        </button>
      </div>
      <div class="volume-control">
        <input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="50">
        <span class="music-info" id="volumeDisplay">50%</span>
      </div>
    </div>
  `;

  // Add player to page when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayer);
  } else {
    initPlayer();
  }

  function initPlayer() {
    // Add player to body
    document.body.insertAdjacentHTML('beforeend', playerHTML);

    const audio = document.getElementById('bgMusic');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeDisplay = document.getElementById('volumeDisplay');

    // Load saved settings from localStorage
    const savedVolume = localStorage.getItem('musicVolume') || 50;
    const wasMuted = localStorage.getItem('musicMuted') === 'true';
    const wasPlaying = localStorage.getItem('musicPlaying') === 'true';

    // Set initial volume
    audio.volume = savedVolume / 100;
    volumeSlider.value = savedVolume;
    volumeDisplay.textContent = savedVolume + '%';

    // Set initial mute state
    if (wasMuted) {
      audio.muted = true;
      muteBtn.textContent = '🔇';
    }

    // Play/Pause functionality
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(err => console.log('Audio play failed:', err));
        playPauseBtn.textContent = '⏸️';
        localStorage.setItem('musicPlaying', 'true');
      } else {
        audio.pause();
        playPauseBtn.textContent = '▶️';
        localStorage.setItem('musicPlaying', 'false');
      }
    });

    // Mute functionality
    muteBtn.addEventListener('click', () => {
      audio.muted = !audio.muted;
      muteBtn.textContent = audio.muted ? '🔇' : '🔊';
      localStorage.setItem('musicMuted', audio.muted);
    });

    // Volume control
    volumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value;
      audio.volume = volume / 100;
      volumeDisplay.textContent = volume + '%';
      localStorage.setItem('musicVolume', volume);

      // Unmute if volume is adjusted
      if (audio.muted && volume > 0) {
        audio.muted = false;
        muteBtn.textContent = '🔊';
        localStorage.setItem('musicMuted', 'false');
      }
    });

    // Auto-play if it was playing before (with user interaction required)
    if (wasPlaying) {
      // Try to play, but browsers may block auto-play
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playPauseBtn.textContent = '⏸️';
          })
          .catch(err => {
            // Auto-play was prevented, show play button
            console.log('Auto-play prevented:', err);
            playPauseBtn.textContent = '▶️';
          });
      }
    }

    // Handle audio errors
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      playPauseBtn.textContent = '❌';
      playPauseBtn.disabled = true;
    });

    // Visual feedback when music is playing
    audio.addEventListener('play', () => {
      playPauseBtn.textContent = '⏸️';
    });

    audio.addEventListener('pause', () => {
      playPauseBtn.textContent = '▶️';
    });
  }
})();
