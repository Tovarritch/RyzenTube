import { BUILD_LABEL } from './buildInfo.js';

// Session-only status for troubleshooting on a TV without a developer console.
// It is never uploaded and does not keep a viewing history.
export const diagnostics = {
    build: BUILD_LABEL,
    initialized: false,
    dislikeRequest: 'No request yet',
    dislikeDisplay: 'Waiting for player controls',
    back: 'Back has not been pressed',
};

export function setDiagnostic(key, value) {
    diagnostics[key] = value;
}
