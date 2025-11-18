// composer.js

// --- 1. CONFIGURATION ---
// Defines 3 Octaves (C3 to B5) using the 12-note chromatic scale (Sa-Re-Ga-Ma logic)
const notes = [];
const noteNames = ["Sa'", "Ni", "Dha", "Pa", "Ma'", "Ma", "Ga", "Re", "Sa", "Ni.", "Dha.", "Pa."]; // Simplified ICM names for chromatic scale
const absoluteNotes = ["C", "B", "Bb", "A", "Ab", "G", "F#", "F", "E", "Eb", "D", "Db"]; // Scientific notes

for (let oct = 5; oct >= 3; oct--) {
    absoluteNotes.forEach((absNote, i) => {
        // Map Scientific Pitch (C5) to an ICM label (Sa')
        notes.push({ 
            pitch: absNote + oct, 
            label: noteNames[i % 12] + (oct === 5 ? "'" : oct === 3 ? "." : "")
        });
    });
}

let beats = 16;
// gridData is a map: { 0: "C4", 1: "E4", 2: null, ... }
let gridData = {}; 
let isPlaying = false;
let loop;
let currentCol = 0;
let currentInst = "harmonium";
let sampler;
let synth; // Will be initialized later

// --- 2. INSTRUMENT SETUP & RECORDER ---
function setupAudio() {
    // Recorder is used to export the final audio file
    const recorder = new Tone.Recorder();
    
    // We connect all output to the recorder, and then to the speakers (toDestination)
    synth = new Tone.Synth().connect(recorder);
    synth.toDestination(); // Fallback for when sample isn't loaded

    sampler = new Tone.Sampler({
        urls: { C4: "C4.wav" },
        baseUrl: `./samples/${currentInst}/`,
        onload: () => console.log("Sampler Ready")
    }).connect(recorder).toDestination();

    return recorder;
}

let recorder = setupAudio();

function getInst() {
    if (document.getElementById('instSelect').value === 'synth') return synth;
    return sampler.loaded ? sampler : synth;
}

// --- 3. GRID GENERATION & INTERACTION ---
function generateGrid() {
    beats = parseInt(document.getElementById('beatsInput').value);
    const container = document.getElementById('gridContainer');
    
    // Set up the grid structure: 1 label column + 'beats' columns
    container.style.gridTemplateColumns = `50px repeat(${beats}, 25px)`;
    container.innerHTML = "";
    
    // Grid Header (Beat Numbers)
    container.appendChild(createCell("div", "Note", "row-label")); 
    for(let i=0; i<beats; i++) {
        container.appendChild(createCell("div", i+1, "row-label"));
    }

    // Note Rows
    notes.forEach((noteObj) => {
        // Label
        let label = createCell("div", noteObj.label, "row-label");
        container.appendChild(label);

        // Cells
        for(let b=0; b<beats; b++) {
            let cell = document.createElement("div");
            cell.className = "cell";
            cell.id = `cell-${noteObj.pitch}-${b}`;
            cell.onclick = () => toggleNote(noteObj.pitch, b);
            
            // Restore state
            if(gridData[b] === noteObj.pitch) cell.classList.add("active");
            
            container.appendChild(cell);
        }
    });
}


function createCell(type, content, className) {
    let el = document.createElement(type);
    el.innerText = content;
    if(className) el.className = className;
    return el;
}

function toggleNote(pitch, beat) {
    const cellId = `cell-${pitch}-${beat}`;
    const cell = document.getElementById(cellId);
    
    // Logic: Only one note allowed per beat (monophonic Lehra)
    if(gridData[beat]) {
        let oldPitch = gridData[beat];
        let oldCell = document.getElementById(`cell-${oldPitch}-${beat}`);
        if(oldCell) oldCell.classList.remove("active");
    }

    if(gridData[beat] === pitch) {
        // Turn off
        delete gridData[beat];
        cell.classList.remove("active");
    } else {
        // Turn on
        gridData[beat] = pitch;
        cell.classList.add("active");
        getInst().triggerAttackRelease(pitch, "8n"); // Preview sound
    }
}

function clearGrid() {
    gridData = {};
    generateGrid(); // Re-render to clear visuals
}

// --- 4. PLAYBACK CONTROLS ---
async function toggleCompostion() {
    await Tone.start();

    if(isPlaying) {
        Tone.Transport.stop();
        if(loop) loop.cancel();
        isPlaying = false;
        document.getElementById('playBtn').innerText = "Play Loop";
        document.getElementById('playBtn').classList.remove('stop');
        document.querySelectorAll('.playing').forEach(c => c.classList.remove('playing'));
        return;
    }

    isPlaying = true;
    document.getElementById('playBtn').innerText = "Stop";
    document.getElementById('playBtn').classList.add('stop');
    currentCol = 0;

    loop = new Tone.Loop(time => {
        // Visuals (Highlighting the playing column)
        Tone.Draw.schedule(() => {
            // Clear previous column
            let prevCol = (currentCol - 1 + beats) % beats;
            notes.forEach(n => {
                document.getElementById(`cell-${n.pitch}-${prevCol}`).classList.remove('playing');
            });
            // Highlight current column
            notes.forEach(n => {
                document.getElementById(`cell-${n.pitch}-${currentCol}`).classList.add('playing');
            });
        }, time);

        // Audio
        let note = gridData[currentCol];
        if(note) getInst().triggerAttackRelease(note, "8n", time);

        currentCol = (currentCol + 1) % beats;
    }, "4n").start(0);

    Tone.Transport.start();
}

function setTempo(val) {
    Tone.Transport.bpm.value = val;
    document.getElementById('bpmDisplay').innerText = val + " BPM";
}

// --- 5. EXPORT AUDIO ---
async function exportAudio() {
    if(Object.keys(gridData).length === 0) { alert("Compose something first!"); return; }
    
    // 1. Setup Recorder and Playback
    let exportInst = getInst();
    let recorder = setupAudio();
    
    alert(`Recording one ${beats}-beat cycle at ${Tone.Transport.bpm.value} BPM...`);
    
    // Stop and Reset
    if(isPlaying) toggleCompostion();
    Tone.Transport.bpm.value = parseFloat(document.getElementById('bpmDisplay').innerText);
    
    recorder.start();
    let exportLoop = new Tone.Sequence((time, note) => {
        if(note) exportInst.triggerAttackRelease(note, "8n", time);
    }, Array(beats).fill(null).map((_, i) => gridData[i])).start(0);

    Tone.Transport.start();

    // 2. Calculate Recording Duration (Duration of one cycle + small buffer)
    let tempo = Tone.Transport.bpm.value;
    let duration = (60/tempo) * beats;

    setTimeout(async () => {
        Tone.Transport.stop();
        exportLoop.dispose();
        
        // 3. Stop Recorder and Download
        const recording = await recorder.stop();
        const url = URL.createObjectURL(recording);
        const anchor = document.createElement("a");
        anchor.download = `Lehra-${beats}beats-${currentInst}.webm`;
        anchor.href = url;
        anchor.click();
        
        // Restore current playback status
        toggleCompostion(); // Sets state back to paused
    }, duration * 1000 + 1000); // 1-second buffer for release/cleanup
}

// --- 6. INITIALIZATION ---
document.getElementById('instSelect').addEventListener('change', (e) => { 
    currentInst = e.target.value;
    // Re-initialize sampler for the new instrument or synth
    sampler = getSampler(currentInst);
});

Tone.Transport.bpm.value = 100;
window.onload = generateGrid;