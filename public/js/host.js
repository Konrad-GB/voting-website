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

document.getElementById('pollForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('pollTitle').value;
  const mediaUrl = document.getElementById('mediaUrl').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!mediaUrl) {
    alert('Please enter a media URL');
    return;
  }

  // Validate URL format
  try {
    new URL(mediaUrl);
  } catch (e) {
    alert('Please enter a valid URL (e.g., https://example.com/image.jpg)');
    return;
  }

  // Process URL based on type
  let processedUrl = mediaUrl;
  let mediaType = 'image';
  let isYouTube = false;

  // Check if it's a YouTube URL
  if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
    // Extract YouTube video ID
    let videoId = null;

    // Format 1: https://www.youtube.com/watch?v=VIDEO_ID
    const match1 = mediaUrl.match(/[?&]v=([^&]+)/);
    if (match1) {
      videoId = match1[1];
    }

    // Format 2: https://youtu.be/VIDEO_ID
    const match2 = mediaUrl.match(/youtu\.be\/([^?&]+)/);
    if (match2) {
      videoId = match2[1];
    }

    // Format 3: https://www.youtube.com/embed/VIDEO_ID
    const match3 = mediaUrl.match(/youtube\.com\/embed\/([^?&]+)/);
    if (match3) {
      videoId = match3[1];
    }

    if (videoId) {
      // Convert to embed URL
      processedUrl = `https://www.youtube.com/embed/${videoId}`;
      mediaType = 'video';
      isYouTube = true;
      console.log('Converted YouTube URL:', processedUrl);
      console.log('Video ID:', videoId);
    } else {
      alert('Could not extract YouTube video ID from URL');
      return;
    }
  } else {
    // For non-YouTube URLs, detect if it's an image
    const urlLower = mediaUrl.toLowerCase();

    // Check for image extensions
    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/)) {
      mediaType = 'image';
      processedUrl = mediaUrl;
    } else {
      alert('Please use either:\n• YouTube URL for videos\n• Direct image URL (ending in .jpg, .png, .gif, etc.) for images');
      return;
    }
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
        mediaUrl: processedUrl,
        mediaType
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
    document.getElementById('pollForm').reset();
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
      <span style="margin-left: 10px; color: #666;">(${poll.mediaType})</span>
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

async function startPoll(pollIndex) {
  try {
    const response = await fetch(`/api/session/${sessionId}/start/${pollIndex}`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to start poll');

    currentPollIndex = pollIndex;
    currentPoll = polls[pollIndex];

    document.getElementById('currentPollTitle').textContent = currentPoll.title;

    const mediaContainer = document.getElementById('currentPollMedia');

    if (currentPoll.mediaType === 'video') {
      // Embed YouTube video
      mediaContainer.innerHTML = `
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
          <iframe
            src="${currentPoll.mediaUrl}"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      `;
    } else {
      // Display image
      mediaContainer.innerHTML = `
        <img src="${currentPoll.mediaUrl}" alt="${currentPoll.title}"
             style="max-width: 100%; max-height: 700px; display: block; margin: 0 auto; border-radius: 8px;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div style="display: none; text-align: center; padding: 40px; background: #fed7d7; border-radius: 12px; color: #e53e3e;">
          <strong>⚠️ Image failed to load</strong><br>
          URL: ${currentPoll.mediaUrl}<br><br>
          Make sure the image URL is publicly accessible.
        </div>
      `;
    }

    document.getElementById('totalVotes').textContent = '0';
    document.getElementById('averageRating').textContent = '-';
    document.getElementById('ratingsList').innerHTML = '';
    document.getElementById('pollProgress').textContent = `Poll ${pollIndex + 1} of ${polls.length}`;

    startPolling();

    const nextBtn = document.getElementById('nextPollBtn');
    if (pollIndex >= polls.length - 1) {
      nextBtn.textContent = 'Finish Session';
      nextBtn.onclick = async () => {
        stopPolling();
        await saveCompletedPoll();
        showSessionResults();
      };
    } else {
      nextBtn.textContent = 'Next Poll';
      nextBtn.onclick = async () => {
        stopPolling();
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
