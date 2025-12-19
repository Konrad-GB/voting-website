const sessionId = window.location.pathname.split('/')[2];

let polls = [];
let currentPollIndex = -1;
let currentPoll = null;
const hostEmail = 'host@growthboss.com';
let hostVoterId = null;
let pollingInterval = null;

document.getElementById('sessionId').textContent = sessionId;

async function initializeHost() {
  try {
    const response = await fetch('/api/session/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, email: hostEmail })
    });

    const data = await response.json();
    if (data.success) {
      hostVoterId = data.voterId;
    }
  } catch (error) {
    console.error('Error initializing host:', error);
  }
}

initializeHost();

const hostRatingSlider = document.getElementById('hostRatingSlider');
const hostRatingInput = document.getElementById('hostRatingInput');

hostRatingSlider.addEventListener('input', (e) => {
  hostRatingInput.value = e.target.value;
});

hostRatingInput.addEventListener('input', (e) => {
  let value = parseInt(e.target.value);
  if (value < 0) value = 0;
  if (value > 10) value = 10;
  hostRatingInput.value = value;
  hostRatingSlider.value = value;
});

document.getElementById('pollForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('pollTitle').value;
  const mediaFile = document.getElementById('mediaFile').files[0];

  if (!mediaFile) {
    alert('Please select a video or image file');
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = async function(event) {
      const base64Data = event.target.result.split(',')[1];

      const response = await fetch(`/api/session/${sessionId}/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          mediaData: base64Data,
          mediaType: mediaFile.type,
          fileName: mediaFile.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add poll');
      }

      const data = await response.json();

      if (!data.poll) {
        throw new Error('Invalid response from server');
      }

      polls.push(data.poll);
      updatePollsList();
      document.getElementById('pollForm').reset();
      document.getElementById('startVotingBtn').disabled = false;
    };
    reader.readAsDataURL(mediaFile);
  } catch (error) {
    console.error('Error adding poll:', error);
    alert('Error adding poll: ' + error.message);
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
      mediaContainer.innerHTML = `
        <video controls autoplay style="max-width: 100%; max-height: 500px;">
          <source src="${currentPoll.mediaUrl}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `;
    } else if (currentPoll.mediaType === 'image') {
      mediaContainer.innerHTML = `
        <img src="${currentPoll.mediaUrl}" alt="${currentPoll.title}" style="max-width: 100%; max-height: 500px;">
      `;
    }

    hostRatingSlider.value = 5;
    hostRatingInput.value = 5;
    hostRatingSlider.disabled = false;
    hostRatingInput.disabled = false;
    document.getElementById('hostSubmitBtn').disabled = false;
    document.getElementById('hostVoteMessage').classList.add('hidden');

    document.getElementById('totalVotes').textContent = '0';
    document.getElementById('averageRating').textContent = '-';
    document.getElementById('ratingsList').innerHTML = '';
    document.getElementById('pollProgress').textContent = `Poll ${pollIndex + 1} of ${polls.length}`;

    startPolling();

    const nextBtn = document.getElementById('nextPollBtn');
    if (pollIndex >= polls.length - 1) {
      nextBtn.textContent = 'Finish Session';
      nextBtn.onclick = () => {
        stopPolling();
        alert('Session completed! Thank you.');
        window.location.href = '/';
      };
    } else {
      nextBtn.textContent = 'Next Poll';
      nextBtn.onclick = () => {
        stopPolling();
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

    const ratingsList = document.getElementById('ratingsList');
    ratingsList.innerHTML = '<h4 style="margin-bottom: 10px;">Individual Ratings:</h4>' +
      (data.votesWithEmails || []).map((vote) => `
        <div class="rating-item">
          <strong>${vote.email}</strong>: ${vote.rating}/10
        </div>
      `).join('');
  } catch (error) {
    console.error('Error fetching results:', error);
  }
}

document.getElementById('hostSubmitBtn').addEventListener('click', async () => {
  if (!currentPoll || !hostVoterId) {
    alert('Unable to submit vote');
    return;
  }

  const rating = parseInt(hostRatingInput.value);

  try {
    const response = await fetch(`/api/session/${sessionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pollId: currentPoll.id,
        voterId: hostVoterId,
        rating: rating
      })
    });

    if (!response.ok) throw new Error('Failed to submit vote');

    const messageDiv = document.getElementById('hostVoteMessage');
    messageDiv.textContent = 'Your vote submitted successfully!';
    messageDiv.className = 'submit-message success';
    messageDiv.classList.remove('hidden');

    hostRatingSlider.disabled = true;
    hostRatingInput.disabled = true;
    document.getElementById('hostSubmitBtn').disabled = true;

    updateResults();

  } catch (error) {
    const messageDiv = document.getElementById('hostVoteMessage');
    messageDiv.textContent = 'Error submitting vote: ' + error.message;
    messageDiv.className = 'submit-message error';
    messageDiv.classList.remove('hidden');
  }
});

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
