// Fixed, phase-reset partials. No modulation, effects, or stereo widening.
// The gain is fixed across every member, including normalize:false studies.
~litmus = SynthDef(\frequencyLitmus, { |freq=440, amp=1, gate=1|
    var tone = Mix(SinOsc.ar(freq * [1, 2, 3, 4], 0) * [1, 0.5, 0.25, 0.125]);
    var envelope = EnvGen.ar(Env.asr(0.02, 1, 0.3, \lin), gate, doneAction: 2);
    Out.ar(0, (tone * envelope * amp * (0.1 / 1.875)) ! 2);
});
