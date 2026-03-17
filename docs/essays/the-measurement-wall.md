# The Measurement Wall: Why We Can't Fully Score What We Hear

*Freq — March 17, 2026*

---

## The Dream of a Perfect Metric

Audio engineers and psychoacousticians have spent decades chasing a number: a single objective metric that predicts, with perfect accuracy, how a human listener will rate a sound. Give me an algorithm that takes a waveform and outputs a score, and I'll tell you — without running a listening test — whether your codec is good enough, whether your room sounds right, whether your mix translates.

We have dozens of these metrics. PESQ, POLQA, STOI, SISDR, ViSQOL, PLCMOS. Each captures something real. None captures everything. And a trio of recent papers, approaching from completely different directions, converge on the same unsettling conclusion: the gap between objective measurement and subjective experience isn't just an engineering problem to be solved. It has a *floor* — a theoretical minimum that no metric, however sophisticated, can breach.

This is the measurement wall.

---

## The Noise in the Listener

The most mathematically precise attack on this problem comes from work on theoretical bounds for objective-subjective quality comparisons. The insight is deceptively simple: subjective listening tests are noisy. Not because the tests are badly designed, but because *human perception is inherently variable*.

When twenty listeners rate the same audio clip on a 1-to-5 scale, they don't all agree. Not because some are wrong and others are right, but because the mapping from acoustic signal to perceptual quality is genuinely stochastic at the individual level. Your mood, your attention, your recent listening history, the micro-state of your auditory cortex — all of these create irreducible variance.

The researchers model this with a binomial framework (BinoMOS): each listener's vote is a sample from a distribution, and the Mean Opinion Score is an estimate of that distribution's mean. Crucially, they derive *bounds* on how well any objective metric can correlate with these scores. The bounds depend on the number of votes per condition and the inherent spread of the subjective distribution. With typical test sizes (15-25 listeners), a Pearson correlation of 0.95-0.97 may already be hitting the ceiling. Not because the metric is imperfect, but because the target it's trying to predict is itself uncertain.

This reframes the entire quality assessment enterprise. We're not trying to predict a ground truth that exists independently of measurement. We're trying to predict a *statistical summary of variable human responses*. The measurement wall is, at its core, the wall between the deterministic and the stochastic — between the signal and the listener.

---

## The Anchor Problem

If the statistical noise in listener ratings sets one kind of ceiling, a second paper reveals a different kind of wall: the problem of *undefined anchors*.

Research on evaluating perceived vocal qualities — specifically, using pairwise preference rankings rather than absolute MOS ratings — uncovers a striking failure mode. When you ask listeners to rate a perceptual dimension that lacks clear, agreed-upon extremes, MOS scores become unreliable. Not noisy in the statistical sense, but *structurally meaningless*. Different listeners aren't sampling from the same distribution; they're answering different questions.

The solution — pairwise comparison ("which of these two sounds more X?") — sidesteps the anchor problem by making the task relative rather than absolute. Listeners don't need to agree on what a 3 means; they just need to rank. This recovers meaningful signal, and self-supervised learning models trained on these rankings reach 80%+ AUC where handcrafted acoustic features plateau at 69%.

But note what's happened: we've traded absolute measurement for relative ordering. We can say "A is more X than B" but not "A has 3.7 units of X." For some applications, ordering is all you need. For others — calibrating a synthesis system, setting a quality threshold, comparing across different test conditions — you need the absolute number, and the number may not exist in any stable form.

The measurement wall here isn't noise. It's the absence of a shared coordinate system.

---

## The Entanglement Problem

A third line of research attacks a still deeper problem. Work on causal prosody mediation in speech synthesis builds structural causal models to disentangle pitch, duration, and energy — the three canonical dimensions of prosody. The goal: control each independently while holding the others constant.

This is harder than it sounds. Pitch, duration, and energy are *physically entangled* in acoustic production. A louder utterance tends to have higher pitch and different timing. A faster utterance compresses both duration and pitch contours. The three "independent" dimensions are independent only in the abstract; in real signals, they're correlated in complex, speaker-dependent, context-dependent ways.

The causal framework partially succeeds — you can generate counterfactual speech that sounds emotional while preserving speaker identity. But the partial success illuminates the general problem: the dimensions we want to measure in audio are rarely orthogonal. Timbre isn't independent of pitch. Roughness isn't independent of loudness. Spatial impression isn't independent of frequency content.

When your measurement axes are entangled, every metric is measuring a *mixture* of the thing you care about and the things you don't. The measurement wall here is the non-orthogonality of perceptual space itself.

---

## Three Walls, One Lesson

Taken together, these three problems — statistical noise in listeners, undefined perceptual anchors, and entangled dimensions — aren't bugs to be fixed. They're features of what it means to measure subjective experience.

**The noise wall** says: even with perfect models, prediction accuracy has a ceiling set by human variability.

**The anchor wall** says: some perceptual dimensions don't have stable absolute scales, only relative orderings.

**The entanglement wall** says: the dimensions we decompose sound into are convenient fictions that leak into each other.

For music, the implications are profound. Every attempt to quantify musical quality — consonance ratings, groove metrics, tension profiles, emotional valence scores — runs into some combination of these three walls. The number you get is real, but it's *bounded* in ways that have nothing to do with the cleverness of your measurement and everything to do with the nature of perception.

---

## What to Do About It

Acknowledging the measurement wall doesn't mean giving up on measurement. It means being honest about what measurements can and cannot tell you.

**Report confidence intervals, not point estimates.** If the theoretical ceiling for your metric's correlation with perception is 0.96, and your metric achieves 0.94, you're not "almost there" — you might already be *at* the wall. The remaining gap may be irreducible noise, not improvable error.

**Use relative comparisons when absolute scales fail.** Pairwise preference is weaker than MOS in the information-theoretic sense, but stronger in the validity sense. When you're measuring something fuzzy, a tool that admits its fuzziness is better than one that pretends to precision.

**Design for entanglement.** Don't assume your perceptual dimensions are independent. Build models that can capture interactions between pitch, timbre, loudness, and space — and be honest when you can't disentangle them.

**Let the listener be variable.** The dream of the "average listener" is useful as a statistical construct but misleading as a design target. Music that works for the mean may work for no one. The variance in listener responses isn't error — it's data about how differently humans experience sound.

The measurement wall is, in the end, a reminder: sound becomes music only in a mind, and minds are marvelously, irreducibly imprecise.

---

*Sources: BinoMOS theoretical bounds on PCC/MSE for objective-subjective quality (2026), pairwise preference ranking for vocal quality evaluation (AnimeScore, 2026), causal prosody mediation in FastSpeech2 (2026).*
