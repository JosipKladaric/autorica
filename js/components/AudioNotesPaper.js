/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore } from '../store.js';

export function AudioNotesPaper() {
    const container = document.createElement('div');
    container.className = 'audio-notes-paper';

    // Header container with Flexbox
    const header = document.createElement('div');
    header.className = 'audio-notes-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.textAlign = 'left'; // Override css center
    header.style.padding = '0 4px 4px 4px';

    const title = document.createElement('span');
    title.innerText = '🎤 Audio Bilješke';
    header.appendChild(title);

    // Controls inside header
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '6px';

    let mediaRecorder = null;
    let audioChunks = [];
    let recordingTime = 0;
    let recordingInterval = null;

    const recordBtn = createButton('🔴', 'Record');
    const stopBtn = createButton('⏹️', 'Stop');
    stopBtn.style.display = 'none';

    // Make buttons smaller for header
    [recordBtn, stopBtn].forEach(btn => {
        btn.style.width = '28px';
        btn.style.height = '28px';
        btn.style.fontSize = '14px';
        btn.style.borderRadius = '6px';
    });

    recordBtn.onclick = startRecording;
    stopBtn.onclick = stopRecording;

    controls.appendChild(recordBtn);
    controls.appendChild(stopBtn);
    header.appendChild(controls);

    container.appendChild(header);

    // Audio List
    const audioList = document.createElement('div');
    audioList.className = 'audio-list';
    container.appendChild(audioList);

    // Load existing audio notes from store
    loadAudioNotes();

    function createButton(emoji, title) {
        const btn = document.createElement('div');
        btn.className = 'audio-btn';
        btn.title = title;
        btn.innerHTML = emoji;
        return btn;
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            recordingTime = 0;

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                saveAudioNote(audioUrl, recordingTime);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            recordBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            stopBtn.classList.add('recording');

            // Track recording time
            recordingInterval = setInterval(() => {
                recordingTime++;
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please grant permission.');
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            clearInterval(recordingInterval);

            recordBtn.style.display = 'flex';
            stopBtn.style.display = 'none';
            stopBtn.classList.remove('recording');
        }
    }

    function saveAudioNote(audioUrl, duration) {
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const audioNote = {
            id: Date.now().toString(),
            url: audioUrl,
            duration: duration,
            timestamp: timestamp,
            date: new Date().toISOString()
        };

        // Save to store
        const state = appStore.getState();
        const audioNotes = state.audioNotes || [];
        audioNotes.push(audioNote);
        appStore.setState({ audioNotes });

        // Add to UI
        addAudioItem(audioNote);
    }

    function loadAudioNotes() {
        const state = appStore.getState();
        const audioNotes = state.audioNotes || [];
        audioNotes.forEach(note => addAudioItem(note));
    }

    function addAudioItem(note) {
        const item = document.createElement('div');
        item.className = 'audio-item';
        item.dataset.id = note.id;

        const playBtn = document.createElement('span');
        playBtn.className = 'audio-item-play';
        playBtn.innerHTML = '▶️';
        playBtn.title = 'Play';

        let audio = null;
        playBtn.onclick = () => {
            if (audio && !audio.paused) {
                audio.pause();
                audio.currentTime = 0;
                playBtn.innerHTML = '▶️';
            } else {
                // Stop all other playing audio
                document.querySelectorAll('audio').forEach(a => a.pause());
                document.querySelectorAll('.audio-item-play').forEach(p => p.innerHTML = '▶️');

                audio = new Audio(note.url);
                audio.play();
                playBtn.innerHTML = '⏸️';

                audio.onended = () => {
                    playBtn.innerHTML = '▶️';
                };
            }
        };

        const time = document.createElement('span');
        time.className = 'audio-time';
        time.textContent = note.timestamp;

        const duration = document.createElement('span');
        duration.className = 'audio-time';
        duration.textContent = `${note.duration}s`;

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'audio-item-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = () => {
            if (confirm('Delete this audio note?')) {
                // Remove from store
                const state = appStore.getState();
                const audioNotes = (state.audioNotes || []).filter(n => n.id !== note.id);
                appStore.setState({ audioNotes });

                // Remove from UI
                item.remove();
            }
        };

        item.appendChild(playBtn);
        item.appendChild(time);
        item.appendChild(duration);
        item.appendChild(deleteBtn);

        audioList.appendChild(item);
    }

    return container;
}
