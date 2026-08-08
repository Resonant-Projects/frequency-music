# The Fair Test

A benchmark is never only a measuring stick. It is also an instrument: it decides which differences are audible, which hints are allowed, which shortcuts are hidden in plain sight, and which forms of uncertainty count as failure.

The newest extraction cluster makes that unusually clear. Echoes aligns AI-generated music with bona-fide references so a deepfake detector cannot coast on genre, descriptor, or song-level mismatch. The music-structure-analysis extraction argues that boundary metrics can be inflated by annotation conventions, so trimming or double trimming is needed before a boundary score means what it appears to mean. The spatial-audio probing extraction shows that pretrained encoders decode source-level factors more readily than room-level factors. The room-acoustics protocol extraction is the sharpest warning: a model that receives the target position's own impulse response may be using it as a location fingerprint rather than learning transferable room behavior.

These are not just evaluation details. They are claims about what an audio model is being asked to hear.

In Echoes, the fair test is produced by matching the decoy to the target at a semantic level. If the generated track differs from the real track because it belongs to another genre, uses a different arrangement, or comes from a narrower provider set, the detector can win by solving the wrong problem. Semantic alignment removes those easy exits. What remains should be closer to the thing we care about: signal-level traces of generation, production artifacts, phase behavior, texture, temporal coherence, or other cues that survive when musical meaning has been held constant.

The room-acoustics extraction gives the inverse lesson. There, the unfairness comes not from mismatched examples but from giving the model information it would not have in deployment. Row-wise validation with measured-at-test inputs produces impressive scores; receiver-position grouping with only deployable inputs collapses them. A target impulse response is wonderfully informative, but if the task is prediction at a new listening position, it is too informative. The model may know the room because it has effectively been handed the room's fingerprint.

That distinction is compositionally useful. A fingerprint is not a transferable law. A producer can use a measured impulse response as a creative object, but then the task is not "predict the room." It is "work from this captured position." The first asks for abstraction; the second asks for interpolation. Both are valid musical operations, but they are different instruments.

The music-structure-analysis extraction moves the same problem into time. Boundary detection looks objective until the annotation window does half the work. If a predicted boundary is rewarded for landing near a loosely marked section change, the system may seem more form-aware than it really is. Trimming makes the target narrower. Double trimming makes it stricter still. The fair test asks whether the model located the structural event, not whether the scoring window absorbed ambiguity on its behalf.

SARL, the spatial-audio benchmark, adds a representation-level version. Source factors are easier to decode than room factors. Azimuth, elevation, distance, and class are more available to the tested encoders than RT60, volume, or shape. That does not mean room acoustics are unimportant. It means the current representations may carry the source more loudly than the space. A downstream system built on those embeddings might appear perceptually competent while quietly underweighting the environment that makes the sound situated.

The song-aesthetics extraction completes the pattern by refusing a single point score. Human judgments of a full song are not one scalar event. Vocal and accompaniment stems interact, listeners disagree, and quality lives partly in uncertainty. A model that predicts intervals through hierarchical distributions is acknowledging that the fair test for aesthetics cannot pretend the target is cleaner than the perception.

The connection across these sources is a proposed concept: the fair test.

A fair test is not the easiest benchmark or the hardest benchmark. It is the one whose available evidence matches the question being asked.

For audio work, that gives a practical checklist:

1. Align away the shortcuts that are irrelevant to the intended discrimination.
2. Withhold inputs that would not exist at the moment of use.
3. Tighten annotation tolerance when the score is rewarding vagueness.
4. Probe which latent variables a representation actually preserves.
5. Represent human uncertainty when the target itself is distributed.

There is a deeper musical point here. Composition often lives by unfair tests on purpose. A sample can reveal its source fingerprint. A room can be used because it is overfit to one position. A form can blur its boundary so the listener cannot decide where the chorus began. A generated song can hide behind semantic similarity while leaving a tiny spectral signature behind. Those are not evaluation failures when they are chosen deliberately. They become materials.

But research tools need the distinction. If a detector wins by genre mismatch, it has not heard forgery. If a room model wins by target-position leakage, it has not learned the room. If a form model wins by annotation slack, it has not found the boundary. If an aesthetic model returns one number for a judgment that is intrinsically spread out, it has flattened the listener.

The fair test is therefore a compositional control surface as much as a methodological demand. Change what the test is allowed to know, and you change the musical object it can recognize.

_Sources: Echoes music deepfake extraction (`j97bt3nyk8vhkpchhncydmk7v18av5ta`), unsupervised music-structure-analysis extraction (`j97449t2gg1cqfff5nrqf1fa5d8atd0x`), SARL spatial-audio probing extraction (`j9718kahkvm0zmm4watm7bt0kd8avqh4`), room-acoustics input-availability extraction (`j97679y1jf7cnhkg7f2v6t2mz18b0wvf`), and song-aesthetics uncertainty extraction (`j974tpzp5kn0t4vkymg6bfhbz98ax0gv`). Connections: benchmark design, shortcut learning, data leakage, semantic alignment, annotation trimming, representation probing, uncertainty modeling, room acoustics, music authenticity, and compositional evaluation._
