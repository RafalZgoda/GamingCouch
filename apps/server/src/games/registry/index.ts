/**
 * Built-in game registrations.
 * Import each game module here so it self-registers via GameRegistry.register().
 * Games are loaded once at server start.
 */

// Games are registered by their own modules via side-effect imports.
import '../trivia/TriviaGame.js';
import '../reaction/ReactionGame.js';
import '../colormatch/ColorMatchGame.js';
import '../mathrace/MathRaceGame.js';
import '../wordscramble/WordScrambleGame.js';
import '../hotpotato/HotPotatoGame.js';
import '../trueorfalse/TrueFalseGame.js';
import '../tapfrenzy/TapFrenzyGame.js';
