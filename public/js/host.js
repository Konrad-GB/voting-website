const sessionId = window.location.pathname.split('/')[2];
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode'); // 'edit' or 'present' or null (live)

let polls = [];
let currentPollIndex = -1;
let currentPoll = null;
let pollingInterval = null;
let completedPolls = []; // Store results of completed polls

document.getElementById('sessionId').textContent = sessionId;

// Load existing polls if in edit or present mode
async function loadExistingPolls() {
  try {
    const response = await fetch(`/api/session/${sessionId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.polls && data.polls.length > 0) {
        polls = data.polls;
        updatePollsList();
        document.getElementById('startVotingBtn').disabled = false;
      }
    }
  } catch (error) {
    console.error('Error loading existing polls:', error);
  }
}

// If in edit or present mode, load existing polls
if (mode === 'edit' || mode === 'present') {
  loadExistingPolls();
}

// Update button text based on mode
if (mode === 'edit') {
  document.getElementById('startVotingBtn').textContent = 'Save & Exit';
  document.getElementById('startVotingBtn').onclick = function() {
    alert('Session saved! You can present it anytime from the saved sessions page.');
    window.location.href = '/session-select';
  };
} else if (mode === 'present') {
  document.getElementById('startVotingBtn').textContent = 'Start Presenting';
}

// Add media item functionality
document.getElementById('addMediaBtn').addEventListener('click', () => {
  const container = document.getElementById('mediaItemsContainer');
  const mediaItem = document.createElement('div');
  mediaItem.className = 'media-item-input';
  mediaItem.innerHTML = `
    <input type="url" class="media-url-input" placeholder="https://example.com/image.jpg or YouTube URL" required>
    <select class="media-type-select">
      <option value="image">Image</option>
      <option value="video">Video</option>
    </select>
    <button type="button" class="btn btn-small remove-media-btn">Remove</button>
  `;
  container.appendChild(mediaItem);
  updateRemoveButtons();
});

// Handle remove media button
document.getElementById('mediaItemsContainer').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-media-btn')) {
    e.target.parentElement.remove();
    updateRemoveButtons();
  }
});

function updateRemoveButtons() {
  const items = document.querySelectorAll('.media-item-input');
  items.forEach((item, index) => {
    const removeBtn = item.querySelector('.remove-media-btn');
    removeBtn.style.display = items.length > 1 ? 'inline-block' : 'none';
  });
}

document.getElementById('pollForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('pollTitle').value;
  const timer = parseInt(document.getElementById('pollTimer').value) || 60;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  // Collect all media items
  const mediaInputs = document.querySelectorAll('.media-item-input');
  const mediaItems = [];

  for (const input of mediaInputs) {
    const url = input.querySelector('.media-url-input').value.trim();
    const type = input.querySelector('.media-type-select').value;

    if (!url) continue;

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      alert('Please enter valid URLs for all media items');
      return;
    }

    // Process URL based on type
    let processedUrl = url;

    if (type === 'video' && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      // Extract YouTube video ID
      let videoId = null;

      // Format 1: https://www.youtube.com/watch?v=VIDEO_ID
      const match1 = url.match(/[?&]v=([^&]+)/);
      if (match1) {
        videoId = match1[1];
      }

      // Format 2: https://youtu.be/VIDEO_ID
      const match2 = url.match(/youtu\.be\/([^?&]+)/);
      if (match2) {
        videoId = match2[1];
      }

      // Format 3: https://www.youtube.com/embed/VIDEO_ID
      const match3 = url.match(/youtube\.com\/embed\/([^?&]+)/);
      if (match3) {
        videoId = match3[1];
      }

      if (videoId) {
        processedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else {
        alert('Could not extract YouTube video ID from URL');
        return;
      }
    }

    mediaItems.push({ url: processedUrl, type });
  }

  if (mediaItems.length === 0) {
    alert('Please add at least one media item');
    return;
  }

  // Show loading state
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding poll...';

  try {
    const response = await fetch(`/api/session/${sessionId}/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        mediaItems,
        timer
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to add poll');
    }

    if (!data.poll) {
      throw new Error('Invalid response from server');
    }

    polls.push(data.poll);
    updatePollsList();

    // Reset form
    document.getElementById('pollForm').reset();
    document.getElementById('pollTimer').value = 60;

    // Remove extra media items
    const container = document.getElementById('mediaItemsContainer');
    while (container.children.length > 1) {
      container.removeChild(container.lastChild);
    }
    updateRemoveButtons();

    document.getElementById('startVotingBtn').disabled = false;

    // Show success feedback
    submitBtn.textContent = 'Poll Added!';
    setTimeout(() => {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Error adding poll:', error);
    alert('Error adding poll: ' + error.message);
    submitBtn.textContent = originalBtnText;
    submitBtn.disabled = false;
  }
});

function updatePollsList() {
  const container = document.getElementById('pollsContainer');
  container.innerHTML = polls.map((poll, index) => `
    <div class="poll-item">
      <strong>Poll ${index + 1}:</strong> ${poll.title}
      <span style="margin-left: 10px; color: #666;">(${poll.mediaItems.length} media item${poll.mediaItems.length > 1 ? 's' : ''}, ${poll.timer}s timer)</span>
    </div>
  `).join('');
}

document.getElementById('startVotingBtn').addEventListener('click', async () => {
  if (polls.length === 0) {
    alert('Please add at least one poll');
    return;
  }

  document.getElementById('setupSection').classList.add('hidden');
  document.getElementById('votingSection').classList.remove('hidden');

  await startPoll(0);
});

let timerInterval = null;

async function startPoll(pollIndex) {
  try {
    const response = await fetch(`/api/session/${sessionId}/start/${pollIndex}`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to start poll');

    currentPollIndex = pollIndex;
    currentPoll = polls[pollIndex];

    document.getElementById('currentPollTitle').textContent = currentPoll.title;

    // Render all media items
    const mediaContainer = document.getElementById('currentPollMedia');
    mediaContainer.innerHTML = currentPoll.mediaItems.map(item => {
      if (item.type === 'video') {
        return `
          <div class="media-gallery-item" style="margin-bottom: 20px;">
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
              <iframe
                src="${item.url}"
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="media-gallery-item" style="margin-bottom: 20px;">
            <img src="${item.url}" alt="Poll media"
                 style="max-width: 100%; max-height: 500px; display: block; margin: 0 auto; border-radius: 8px;"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; text-align: center; padding: 40px; background: #fed7d7; border-radius: 12px; color: #e53e3e;">
              <strong>⚠️ Image failed to load</strong><br>
              URL: ${item.url}
            </div>
          </div>
        `;
      }
    }).join('');

    document.getElementById('totalVotes').textContent = '0';
    document.getElementById('averageRating').textContent = '-';
    document.getElementById('ratingsList').innerHTML = '';
    document.getElementById('pollProgress').textContent = `Poll ${pollIndex + 1} of ${polls.length}`;

    // Start timer countdown
    startTimer(currentPoll.timer);

    startPolling();

    const nextBtn = document.getElementById('nextPollBtn');
    if (pollIndex >= polls.length - 1) {
      nextBtn.textContent = 'Finish Session';
      nextBtn.onclick = async () => {
        stopPolling();
        stopTimer();
        await saveCompletedPoll();
        showSessionResults();
      };
    } else {
      nextBtn.textContent = 'Next Poll';
      nextBtn.onclick = async () => {
        stopPolling();
        stopTimer();
        await saveCompletedPoll();
        startPoll(pollIndex + 1);
      };
    }
  } catch (error) {
    alert('Error starting poll: ' + error.message);
  }
}

function startPolling() {
  stopPolling();
  updateResults();
  pollingInterval = setInterval(updateResults, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function startTimer(duration) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  let timeLeft = duration;
  const timerValue = document.getElementById('timerValue');
  const timerDisplay = document.getElementById('timerDisplay');

  timerValue.textContent = timeLeft;
  timerDisplay.style.background = '#48bb78';
  timerDisplay.style.color = 'white';

  timerInterval = setInterval(() => {
    timeLeft--;
    timerValue.textContent = timeLeft;

    // Change color as time runs out
    if (timeLeft <= 10) {
      timerDisplay.style.background = '#e53e3e';
    } else if (timeLeft <= 30) {
      timerDisplay.style.background = '#ed8936';
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerDisplay.style.background = '#718096';
      timerValue.textContent = '0';
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function updateResults() {
  if (!currentPoll) return;

  try {
    const response = await fetch(`/api/session/${sessionId}/results/${currentPoll.id}`);
    const data = await response.json();

    document.getElementById('totalVotes').textContent = data.totalVotes;
    document.getElementById('averageRating').textContent = data.average;

    // Hide individual ratings during live voting
    const ratingsList = document.getElementById('ratingsList');
    ratingsList.innerHTML = '';
  } catch (error) {
    console.error('Error fetching results:', error);
  }
}

async function saveCompletedPoll() {
  if (!currentPoll) return;

  try {
    const response = await fetch(`/api/session/${sessionId}/results/${currentPoll.id}`);
    const data = await response.json();

    completedPolls.push({
      title: currentPoll.title,
      pollId: currentPoll.id,
      totalVotes: data.totalVotes,
      average: data.average,
      votesWithEmails: data.votesWithEmails || []
    });
  } catch (error) {
    console.error('Error saving completed poll:', error);
  }
}

function showSessionResults() {
  document.getElementById('votingSection').classList.add('hidden');

  const container = document.querySelector('.host-dashboard');

  const resultsSection = document.createElement('div');
  resultsSection.className = 'session-results';
  resultsSection.innerHTML = `
    <h2>Session Complete - Final Results</h2>
    <p>All polls have been completed. Click on each poll to see detailed results.</p>
    <div id="completedPollsContainer"></div>
    <button onclick="window.location.href='/'" class="btn btn-primary" style="margin-top: 20px;">Back to Home</button>
  `;

  container.appendChild(resultsSection);

  const completedContainer = document.getElementById('completedPollsContainer');
  completedContainer.innerHTML = completedPolls.map((poll, index) => `
    <div class="completed-poll-card">
      <div class="completed-poll-header" onclick="togglePollDetails(${index})">
        <h3>Poll ${index + 1}: ${poll.title}</h3>
        <div class="poll-summary">
          <span>Total Votes: ${poll.totalVotes}</span>
          <span>Average: ${poll.average}/10</span>
          <span class="dropdown-arrow" id="arrow-${index}">▼</span>
        </div>
      </div>
      <div class="completed-poll-details hidden" id="details-${index}">
        ${poll.votesWithEmails.length > 0 ? `
          <h4>Individual Votes:</h4>
          ${poll.votesWithEmails.map(vote => `
            <div class="vote-detail">
              <strong>${vote.email}</strong>: ${vote.rating}/10
            </div>
          `).join('')}
        ` : '<p>No votes recorded for this poll.</p>'}
      </div>
    </div>
  `).join('');
}

function togglePollDetails(index) {
  const details = document.getElementById(`details-${index}`);
  const arrow = document.getElementById(`arrow-${index}`);

  if (details.classList.contains('hidden')) {
    details.classList.remove('hidden');
    arrow.textContent = '▲';
  } else {
    details.classList.add('hidden');
    arrow.textContent = '▼';
  }
}

function copySessionId() {
  navigator.clipboard.writeText(sessionId).then(() => {
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  });
}
