// Silly Development starts MAIN_FILE directly.
// Apply the Baileys patch before loading the bot.
await import('./patch-baileys.js');
await import('./index.js');
