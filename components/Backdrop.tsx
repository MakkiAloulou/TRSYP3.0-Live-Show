import ParticleField from "./ParticleField";

/** Behind every screen: the arena floor receding into the dark, and the
    drifting particles. (The two corners' light is laid over the whole window
    by the stage, so it fills any screen shape.) */
export default function Backdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="stage-floor" />
      </div>
      <ParticleField />
    </>
  );
}
