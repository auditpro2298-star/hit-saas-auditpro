/**
 * HIT SaaS — Custom Modal Utility (Replacement for native alert and confirm)
 */

(function() {
    // Helper to extract leading emoji or determine modal type
    function parseMessage(message) {
        let emoji = 'ℹ️';
        let type = 'info'; // info, success, warning, danger
        let cleanMsg = message;

        // Check for common leading emojis
        const emojiMatch = message.trim().match(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/);
        
        if (emojiMatch) {
            emoji = emojiMatch[1];
            cleanMsg = message.trim().substring(emoji.length).trim();
            
            // Map emoji to type
            if (emoji === '⚠️') type = 'warning';
            else if (emoji === '✅') type = 'success';
            else if (emoji === '❌' || emoji === '🚫' || emoji === '🔒') type = 'danger';
            else if (emoji === '🎯' || emoji === '📍') type = 'info';
            else if (emoji === '☁️') type = 'offline';
        } else {
            // Check content keywords if no leading emoji
            const lower = message.toLowerCase();
            if (lower.includes('error') || lower.includes('eliminar') || lower.includes('borrar') || lower.includes('bloquear') || lower.includes('revocado')) {
                type = 'danger';
                emoji = '⚠️';
            } else if (lower.includes('exito') || lower.includes('éxito') || lower.includes('exitosamente') || lower.includes('guardado') || lower.includes('correcto')) {
                type = 'success';
                emoji = '✅';
            }
        }

        return { emoji, type, cleanMsg };
    }

    window.showAlert = function(message) {
        return new Promise((resolve) => {
            const { emoji, type, cleanMsg } = parseMessage(message);

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay custom-dialog-overlay';
            overlay.style.zIndex = '999999';

            let typeColor = 'var(--primary)';
            if (type === 'success') typeColor = 'var(--success)';
            else if (type === 'warning') typeColor = 'var(--warning)';
            else if (type === 'danger') typeColor = 'var(--danger)';
            else if (type === 'offline') typeColor = 'var(--saas-purple)';

            overlay.innerHTML = `
                <div class="modal-box custom-dialog-box animate-fade" style="max-width: 420px; border-top: 5px solid ${typeColor}; text-align: center; padding: 2rem 1.5rem 1.5rem 1.5rem;">
                    <div class="custom-dialog-icon-container" style="background: ${typeColor}15; color: ${typeColor}; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto; font-size: 2rem;">
                        ${emoji}
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.75rem; color: var(--text-primary);">
                        ${type.toUpperCase() === 'OFFLINE' ? 'Modo Offline' : type.toUpperCase() === 'DANGER' ? 'Atención' : 'Notificación'}
                    </h3>
                    <p style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; margin-bottom: 1.5rem; text-align: center;">
                        ${cleanMsg}
                    </p>
                    <button class="btn btn-primary custom-dialog-btn" style="background: ${typeColor}; color: white; width: 100%; font-weight: 700; padding: 0.75rem;" id="custom-alert-btn">
                        Aceptar
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);

            const btn = overlay.querySelector('#custom-alert-btn');
            btn.focus();

            const close = () => {
                overlay.remove();
                resolve(true);
            };

            btn.onclick = close;
            overlay.onclick = (e) => {
                if (e.target === overlay) close();
            };
        });
    };

    window.showConfirm = function(message) {
        return new Promise((resolve) => {
            const { emoji, type, cleanMsg } = parseMessage(message);

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay custom-dialog-overlay';
            overlay.style.zIndex = '999999';

            let typeColor = 'var(--warning)';
            if (type === 'danger') typeColor = 'var(--danger)';
            else if (type === 'success') typeColor = 'var(--success)';

            overlay.innerHTML = `
                <div class="modal-box custom-dialog-box animate-fade" style="max-width: 440px; border-top: 5px solid ${typeColor}; padding: 2rem 1.5rem 1.5rem 1.5rem; text-align: center;">
                    <div class="custom-dialog-icon-container" style="background: ${typeColor}15; color: ${typeColor}; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto; font-size: 2rem;">
                        ${emoji}
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.75rem; color: var(--text-primary);">
                        ¿Confirmar Acción?
                    </h3>
                    <p style="font-size: 0.92rem; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; margin-bottom: 1.75rem; text-align: center;">
                        ${cleanMsg}
                    </p>
                    <div class="flex gap-4" style="justify-content: center;">
                        <button class="btn btn-outline" style="flex: 1; font-weight: 700; padding: 0.75rem;" id="custom-confirm-cancel">
                            Cancelar
                        </button>
                        <button class="btn" style="flex: 1; background: ${typeColor}; color: white; font-weight: 700; padding: 0.75rem;" id="custom-confirm-ok">
                            Aceptar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const okBtn = overlay.querySelector('#custom-confirm-ok');
            const cancelBtn = overlay.querySelector('#custom-confirm-cancel');
            
            okBtn.focus();

            const close = (result) => {
                overlay.remove();
                resolve(result);
            };

            okBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            
            overlay.onclick = (e) => {
                if (e.target === overlay) close(false);
            };
        });
    };
})();
