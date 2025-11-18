// player.js

// --- 1. CONFIGURATION (The "Database") ---
// Notes are represented in Scientific Pitch Notation (e.g., "C4")
const lehraDatabase = [
    {
        id: 1, raga: "Yaman", taal: "Tintal", beats: 16, instrument: "harmonium", 
        name: "Yaman Bada", notes: ["C4", "E4", "G4", "B4", "A4", "F#4", "G4", "B4", "C4", "G4", "E4", "D4", "C4", "B3", "A3", "G3"] 
    },
    {
        id: 2, raga: "Bhairav", taal: "Roopak", beats: 7, instrument: "sarangi",
        name: "Bhairav Vilambit", notes: ["C4", "Db4", "E4", "F4", "G4", "Ab4", "C5"]
    },
    {
        id: 3, raga: "Yaman", taal: "Jhaptaal", beats: 10, instrument: "harmonium", 
        name: "Yaman Madhya", notes: ["C4", "E4", "G4", "A4", null, "G4", "F#4", "E4", "D4", "C4"]
    }
];

// --- 2. GLOBAL STATE & INSTRUMENT SETUP ---
let currentSequence;
let isPlaying = false;
let currentInstrument = "harmonium";

function getSampler(instrument) {
    // Tone.js Sampler loads the sound from your samples folder
    return new Tone.Sampler({
        urls: { C4: "C4.wav" }, // Assumes C4.wav is the base pitch
        baseUrl: `./samples/${instrument}/`,
        onload: () => console.log(`${instrument} loaded`)
    }).toDestination();
}

let sampler = getSampler(currentInstrument);
let fallbackSynth = new Tone.Synth().toDestination();

function getInst() {
    return sampler.loaded ? sampler : fallbackSynth;
}

// --- 3. FILTERING AND RENDERING ---
const listDiv = document.getElementById('loopList');
const filters = { taal: 'all', raga: 'all', instrument: 'harmonium' };

function renderList() {
    listDiv.innerHTML = "";
    
    // Filter logic
    const filtered = lehraDatabase.filter(loop => {
        return (filters.taal === 'all' || loop.taal === filters.taal) &&
               (filters.raga === 'all' || loop.raga === filters.raga) &&
               (filters.instrument === 'all' || loop.instrument === filters.instrument);
    });

    if (filtered.length === 0) {
        listDiv.innerHTML = `<div class="card" style="text-align:center;">No loops found matching all criteria.</div>`;
        return;
    }

    filtered.forEach(loop => {
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
            <h3>${loop.name}</h3>
            <p>Taal: ${loop.taal} (${loop.beats} beats) | Raga: ${loop.raga}</p>
            <button onclick="loadLoop(${loop.id})">Load & Play</button>
        `;
        listDiv.appendChild(item);
    });
}

// 4. PLAYBACK CONTROLS
async function loadLoop(id) {
    const loopData = lehraDatabase.find(l => l.id === id);
    document.getElementById('nowPlaying').innerText = `${loopData.name} (${loopData.instrument})`;
    
    // Stop previous and clear events
    if (currentSequence) currentSequence.dispose();
    Tone.Transport.stop();
    
    await Tone.start();
    
    // Re-create sequence
    currentSequence = new Tone.Sequence((time, note) => {
        // Play the note using the Sampler
        if (note) getInst().triggerAttackRelease(note, "8n", time); 
    }, loopData.notes, "4n").start(0); // "4n" = trigger every quarter note (beat)

    // Ensure Transport is started to begin playback
    if (!isPlaying) togglePlay(); 
}

function togglePlay() {
    if (!isPlaying) {
        Tone.Transport.start();
        document.getElementById('playBtn').innerText = "Stop";
        document.getElementById('playBtn').classList.add('stop');
    } else {
        Tone.Transport.stop();
        document.getElementById('playBtn').innerText = "Play";
        document.getElementById('playBtn').classList.remove('stop');
    }
    isPlaying = !isPlaying;
}

function setTempo(val) {
    Tone.Transport.bpm.value = val;
    document.getElementById('bpmDisplay').innerText = val + " BPM";
}

// 5. EVENT LISTENERS
document.getElementById('taalFilter').addEventListener('change', (e) => { filters.taal = e.target.value; renderList(); });
document.getElementById('ragaFilter').addEventListener('change', (e) => { filters.raga = e.target.value; renderList(); });

document.getElementById('instFilter').addEventListener('change', (e) => { 
    filters.instrument = e.target.value; 
    currentInstrument = e.target.value;
    // Re-load sampler with new instrument
    sampler = getSampler(currentInstrument);
    renderList(); 
});

// Initialization
Tone.Transport.bpm.value = 100;
renderList();