
export class Login {
    constructor(container, onLogin) {
        this.container = container;
        this.onLogin = onLogin;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'login-view fade-in';

        const wrapper = document.createElement('div');
        wrapper.className = 'login-card';

        wrapper.innerHTML = `
            <div class="login-brand">
                <h1>Autorica</h1>
            </div>
            <p class="login-tagline">
                Platforma za pisanje koja poštuje privatnost.<br>
                Tvoje riječi, tvoj disk, tvoja kontrola.
            </p>

            <button id="google-login-btn" class="login-btn">
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G">
                Prijavi se putem Googlea
            </button>

            <div class="login-features">
                <div class="feature-item">
                    <strong>🔒 Privatnost na prvom mjestu</strong>
                    Podaci žive na tvom Google Driveu. Nema vanjskih servera.
                </div>
                <div class="feature-item">
                    <strong>☁️ Automatska Sinkronizacija</strong>
                    Besprekidno spremanje i učitavanje direktno iz oblaka.
                </div>
                <div class="feature-item">
                    <strong>✨ Bez Ometanja</strong>
                    Čisto, premium okruženje dizajnirano za fokus.
                </div>
                <div class="feature-item">
                    <strong>📊 Statistika Pisanja</strong>
                    Prati nizove, broj riječi i dnevni napredak.
                </div>
            </div>

            <div class="privacy-note">
                Autorica zahtijeva pristup vlastitoj mapi na tvom Google Driveu za spremanje knjiga.
            </div>
        `;

        wrapper.querySelector('#google-login-btn').onclick = () => {
            this.onLogin();
        };

        this.container.appendChild(wrapper);
    }
}
