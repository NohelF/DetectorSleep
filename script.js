// MicroSleep Detector - Teachable Machine Integration
// URL: https://teachablemachine.withgoogle.com/models/a1nqGgU08/

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/a1nqGgU08/";

let model, webcam, maxPredictions;
let isMonitoring = false;
let sleepingCounter = 0;
let absentCounter = 0;
const ALARM_THRESHOLD = 90; // Approx 3 seconds
let lastAlertTime = 0;
const COOLDOWN_MS = 5000; // 5 seconds cooldown between major alerts

let audioContext;
let oscillator;
let isAlarmPlaying = false;
let currentAlarmType = null; // 'sleeping' or 'absent'

// UI Elements
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const snoozeBtn = document.getElementById('snooze-btn');
const app = document.getElementById('app');
const stateEmoji = document.getElementById('state-emoji');
const stateLabel = document.getElementById('state-label');
const confidenceValue = document.getElementById('confidence-value');
const confidenceFill = document.getElementById('confidence-fill');
const monitoringText = document.getElementById('monitoring-text');
const alertOverlay = document.getElementById('alert-overlay');
const alertMessage = document.getElementById('alert-message');
const loader = document.getElementById('loader');
const badge = document.getElementById('status-badge');

/**
 * 1. Robust Initialization
 */
async function init() {
    console.log("🚀 Iniciando Asistente Inteligente...");

    if (!window.isSecureContext) {
        handleError("Entorno no seguro. La cámara requiere HTTPS o localhost.");
        return;
    }

    try {
        showLoading("Cargando cerebro artificial...");
        
        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";
        
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
        console.log("✅ Modelo cargado. Clases:", model.getClassLabels());

        showLoading("Configurando visión artificial...");
        const flip = true; 
        webcam = new tmImage.Webcam(640, 480, flip); 
        await webcam.setup(); 
        await webcam.play();
        
        isMonitoring = true;
        window.requestAnimationFrame(loop);

        const canvasContainer = document.getElementById("webcam-wrapper");
        canvasContainer.innerHTML = '';
        canvasContainer.appendChild(webcam.canvas);
        
        // Restore decorative elements
        canvasContainer.innerHTML += '<div class="scanline"></div><div class="corners"><span></span><span></span><span></span><span></span></div>';

        hideLoading();
        updateUIState('awake');
        
        startBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden');
        badge.innerText = "MONITOREO ACTIVO";
        badge.style.borderColor = "var(--color-awake)";

    } catch (error) {
        console.error("❌ Error:", error);
        handleError("Error al iniciar: " + error.message);
    }
}

/**
 * 2. Prediction Loop
 */
async function loop() {
    if (isMonitoring) {
        webcam.update();
        await predict();
        window.requestAnimationFrame(loop);
    }
}

async function predict() {
    if (!model || isAlarmPlaying) return;
    
    const prediction = await model.predict(webcam.canvas);
    
    let highestPred = { className: '', probability: 0 };
    prediction.forEach(p => {
        if (p.probability > highestPred.probability) {
            highestPred = p;
        }
    });

    const currentMatch = highestPred.className.toLowerCase();
    const probability = (highestPred.probability * 100).toFixed(1);

    confidenceValue.innerText = probability + "%";
    confidenceFill.style.width = probability + "%";

    const now = Date.now();
    const inCooldown = (now - lastAlertTime < COOLDOWN_MS);

    // Logic for 3 states: Despierto, Dormido, Ausente
    if (currentMatch.includes('dormido') || currentMatch.includes('sleeping')) {
        sleepingCounter++;
        absentCounter = Math.max(0, absentCounter - 5);
        
        if (sleepingCounter >= ALARM_THRESHOLD && !inCooldown) {
            triggerAlarm('sleeping');
        } else if (sleepingCounter > 30) {
            updateUIState('sleeping');
        }
    } 
    else if (currentMatch.includes('ausente') || currentMatch.includes('absence') || currentMatch.includes('none')) {
        absentCounter++;
        sleepingCounter = Math.max(0, sleepingCounter - 5);

        if (absentCounter >= ALARM_THRESHOLD && !inCooldown) {
            triggerAlarm('absent');
        } else if (absentCounter > 30) {
            updateUIState('absent');
        }
    } 
    else {
        // Despierto / Awake
        sleepingCounter = Math.max(0, sleepingCounter - 10);
        absentCounter = Math.max(0, absentCounter - 10);
        updateUIState('awake');
    }
}

/**
 * 3. UI and State Updates
 */
function updateUIState(state) {
    app.classList.remove('state-awake', 'state-absent', 'state-sleeping', 'state-idle');
    app.classList.add('state-' + state);

    switch(state) {
        case 'awake':
            stateEmoji.innerText = "😃";
            stateLabel.innerText = "DESPIERTO";
            monitoringText.innerText = "Monitoreando presencia...";
            badge.style.borderColor = "var(--color-awake)";
            break;
        case 'absent':
            stateEmoji.innerText = "🚫";
            stateLabel.innerText = "AUSENTE";
            monitoringText.innerText = "No se detecta presencia";
            badge.style.borderColor = "var(--color-absent)";
            break;
        case 'sleeping':
            stateEmoji.innerText = "😴";
            stateLabel.innerText = "¡DORMIDO!";
            monitoringText.innerText = "Peligro detectado";
            badge.style.borderColor = "var(--color-sleeping)";
            break;
    }
}

/**
 * 4. Advanced Alert System
 */
function triggerAlarm(type) {
    if (isAlarmPlaying) return;

    isAlarmPlaying = true;
    currentAlarmType = type;
    lastAlertTime = Date.now();
    alertOverlay.classList.remove('hidden');

    if (type === 'sleeping') {
        alertMessage.innerText = "⚠️ Te estás quedando dormido";
        alertOverlay.style.background = "rgba(239, 68, 68, 0.4)";
        playAlarmSound(880, 'sawtooth'); // High piercing beep
    } else {
        alertMessage.innerText = "⚠️ No se detecta presencia humana";
        alertOverlay.style.background = "rgba(245, 158, 11, 0.4)";
        playAlarmSound(440, 'sine'); // Softer sine wave
    }

    badge.innerText = "ALERTA ACTIVADA";
}

function stopAlarm() {
    isAlarmPlaying = false;
    alertOverlay.classList.add('hidden');
    sleepingCounter = 0;
    absentCounter = 0;
    
    if (oscillator) {
        try { oscillator.stop(); } catch(e) {}
    }
    
    updateUIState('awake');
    badge.innerText = "MONITOREO ACTIVO";
}

function playAlarmSound(freq, wave) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') audioContext.resume();

    const loopBeep = () => {
        if (!isAlarmPlaying) return;
        
        oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.4);
        
        setTimeout(loopBeep, 500);
    };
    
    loopBeep();
}

/**
 * 5. Helpers and Listeners
 */
function showLoading(msg) {
    loader.classList.remove('hidden');
    loader.querySelector('p').innerText = msg;
}

function hideLoading() { loader.classList.add('hidden'); }

function handleError(msg) {
    loader.classList.remove('hidden');
    loader.innerHTML = `<div class="error-ui"><p style="color:#ef4444">${msg}</p><button onclick="location.reload()" class="primary-btn">REINTENTAR</button></div>`;
}

startBtn.addEventListener('click', init);
resetBtn.addEventListener('click', () => { isMonitoring = false; location.reload(); });
snoozeBtn.addEventListener('click', stopAlarm);

document.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}, { once: true });
