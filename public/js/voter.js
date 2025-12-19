const sessionId = window.location.pathname.split('/')[2];

let currentPoll = null;
let voterId = localStorage.getItem(`voterId_${sessionId}`);
let pollingInterval = null;
let lastPollId = null;

if (!voterId) {
  window.location.href = '/join-session';
}

const ratingSlider = document.getElementById('ratingSlider');
const ratingInput = document.getElementById('ratingInput');

ratingSlider.addEventListener('input', (e) => {
  ratingInput.value = e.target.value;
});

ratingInput.addEventListener('input', (e) => {
  let value = parseInt(e.target.value);
  if (value < 0) value = 0;
  if (value > 10) value = 10;
  ratingInput.value = value;
  ratingSlider.value = value;
});

function displayPoll(poll, hasVoted = false, voterRating = null) {
  currentPoll = poll;

  document.getElementById('waitingScreen').classList.add('hidden');
  document.getElementById('votingScreen').classList.remove('hidden');

  document.getElementById('pollTitle').textContent = currentPoll.title;

  const mediaContainer = document.getElementById('pollMedia');

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

  if (hasVoted && voterRating !== null) {
    ratingSlider.value = voterRating;
    ratingInput.value = voterRating;
    ratingSlider.disabled = true;
    ratingInput.disabled = true;
    document.getElementById('submitRatingBtn').disabled = true;

    const messageDiv = document.getElementById('submitMessage');
    messageDiv.textContent = `You already submitted your rating: ${voterRating}/10`;
    messageDiv.className = 'submit-message success';
    messageDiv.classList.remove('hidden');
  } else {
    ratingSlider.value = 5;
    ratingInput.value = 5;
    ratingSlider.disabled = false;
    ratingInput.disabled = false;
    document.getElementById('submitMessage').classList.add('hidden');
    document.getElementById('submitRatingBtn').disabled = false;
  }
}

async function checkForPoll() {
  try {
    const response = await fetch(`/api/session/${sessionId}/current-poll?voterId=${voterId}`);

    if (!response.ok) {
      console.error('Failed to fetch current poll:', response.status);
      return;
    }

    const data = await response.json();

    if (data.currentPoll) {
      if (lastPollId !== data.currentPoll.id) {
        lastPollId = data.currentPoll.id;
        displayPoll(data.currentPoll, data.hasVoted, data.voterRating);
      }
    } else {
      if (currentPoll !== null) {
        currentPoll = null;
        lastPollId = null;
        document.getElementById('waitingScreen').classList.remove('hidden');
        document.getElementById('votingScreen').classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Error checking for poll:', error);
  }
}

checkForPoll();
pollingInterval = setInterval(checkForPoll, 2000);

document.getElementById('submitRatingBtn').addEventListener('click', async () => {
  if (!currentPoll) {
    alert('No active poll');
    return;
  }

  const rating = parseInt(ratingInput.value);

  try {
    const response = await fetch(`/api/session/${sessionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pollId: currentPoll.id,
        voterId: voterId,
        rating: rating
      })
    });

    if (!response.ok) throw new Error('Failed to submit vote');

    const messageDiv = document.getElementById('submitMessage');
    messageDiv.textContent = 'Rating submitted successfully!';
    messageDiv.className = 'submit-message success';
    messageDiv.classList.remove('hidden');

    ratingSlider.disabled = true;
    ratingInput.disabled = true;
    document.getElementById('submitRatingBtn').disabled = true;

  } catch (error) {
    const messageDiv = document.getElementById('submitMessage');
    messageDiv.textContent = 'Error submitting rating: ' + error.message;
    messageDiv.className = 'submit-message error';
    messageDiv.classList.remove('hidden');
  }
});
