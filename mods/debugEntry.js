// Entry point of the debug bundle (dbgs/userScript.js): TizenTube plus the
// development console. Only debug APKs load this file.
// override.js must stay first: it may replace everything below with a test
// build sent over adb. The console comes before TizenTube, so a test build
// that breaks TizenTube can still be removed over adb.
import './dev/override.js';
import './dev/devConsole.js';
import './userScript.js';
