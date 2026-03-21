/**
 * Built-in game registrations.
 * Import each game module here so it self-registers via GameRegistry.register().
 * Games are loaded once at server start.
 */

// Games are registered by their own modules via side-effect imports.
import '../trivia/TriviaGame.js';
