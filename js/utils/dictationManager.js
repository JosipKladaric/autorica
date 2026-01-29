
export class DictationManager {
    constructor(onResult, onStatusChange) {
        this.recognition = null;
        this.isListening = false;
        this.onResult = onResult; // ({ final, interim }) => void
        this.onStatusChange = onStatusChange; // (isListening) => void

        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'hr-HR';

            this.recognition.onstart = () => {
                this.isListening = true;
                if (this.onStatusChange) this.onStatusChange(true);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                if (this.onStatusChange) this.onStatusChange(false);
            };

            this.recognition.onerror = (event) => {
                console.warn('Speech recognition error', event.error);
                // Don't verify isListening here as it might be a temporary error or end of session
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    this.isListening = false;
                    if (this.onStatusChange) this.onStatusChange(false);
                }
            };

            this.recognition.onresult = (event) => {
                let interim = '';
                let final = '';

                // event.resultIndex is where we should start processing the new results
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                if (this.onResult) {
                    this.onResult({ final, interim });
                }
            };
        }
    }

    start() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (e) {
                console.warn("Failed to start recognition", e);
            }
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }

    isSupported() {
        return !!this.recognition;
    }
}
