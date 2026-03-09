// ============================================================
// ZOMBIE DEFENSE - Menus (Pause, Game Over)
// ============================================================

// --- Menu Input Handlers (called by input.js router) ---
function pauseHandleKey(code) {
    if (code === 'Escape' && !gameState.gameOver) {
        gameState.paused = !gameState.paused;
    }
}

function drawPauseMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px Jura, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '18px Jura, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press ESC to resume', canvas.width / 2, canvas.height / 2 + 30);
    ctx.restore();
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px Jura, sans-serif';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);
    ctx.font = '20px Jura, sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('The artifact was corrupted and you fell in battle.', canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText(`Wave: ${wave.number} | Zombies Killed: ${gameState.zombiesKilled} | Survived: ${Math.floor(gameTime)}s`, canvas.width / 2, canvas.height / 2 + 55);
    ctx.restore();
}
