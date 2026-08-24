/**
 * Web Audio API Tactile Mechanical Sound Synthesizer (Permanently Muted)
 * Disabled to maintain clean, quiet institutional terminal UX.
 */

class TactileAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  init() {
    // Disabled
  }

  playMechanicalClick() {
    // Completely muted
  }

  playRelaySnap() {
    // Completely muted
  }

  playDialTick() {
    // Completely muted
  }
}

window.tactileAudio = new TactileAudioEngine();
