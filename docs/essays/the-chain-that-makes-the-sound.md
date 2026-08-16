# The Chain That Makes the Sound

Recent extractions keep pointing at the same quiet fact: an audio model does not only learn a sound. It learns a procedure by which a sound stays possible.

StemFX states this most plainly. Mixing style is not reduced to a stereo fingerprint; it is represented as a variable-length chain of effects on source-separated stems. The artistic object is partly an ordered program: choose the processor, choose its parameters, place it after or before another processor, and do this separately for the instrumental strata of the record. A mix style becomes something closer to syntax than color.

The Yoruba synthesis extraction gives the older, rule-based version of the same idea. Tone-marked text passes through diphone selection, five tonal variants, and contextual rules that derive rising and falling contours from level-tone inputs. The sonic output is not a generic voice model's best guess. It is the result of a chain that keeps phonological distinctions executable: oral /n/, nasalized vowel, syllabic nasal, level tone, contour tone, selected unit, modified transition.

The compact Hindi TTS extraction adds a failure boundary. The model can be pruned from the teacher only while the chain still carries the necessary transformations. Depth can be removed gradually, with refinetuning and WER checks, until a capacity cliff appears. Just as importantly, mel-filterbank and rotary-embedding mismatches can silently degrade audio. In that case the learned chain is intact in name but broken in practice: the training-time and inference-time sound-making procedures no longer agree.

Schrodinger Bridge Mamba adds another angle. Denoising and dereverberation are framed as a trajectory rather than a one-shot map, even when inference is compressed to one step. Restoration is treated as passage through a learned path between corrupted and clean speech. The model's value is not only that the endpoint sounds better, but that the trajectory can be made efficient enough for streaming use.

These sources are about different domains: mix transfer, low-resource tone-language synthesis, compact TTS distillation, and speech enhancement. The connection is that each one makes the intermediate procedure musically meaningful. The chain is where control lives.

For composition, that suggests a useful design rule. Do not only expose desired outputs: "brighter," "cleaner," "more spacious," "more natural." Expose the chain that makes those outputs: stem, effect order, contour derivation, model depth, acoustic restoration path, feature parity. A composer can work with a sound more precisely when the system shows which transformations are responsible for keeping it alive.

The practical test is simple: if a parameter changes the sound but cannot be placed in the chain, it may be a useful macro but it is not yet a compositional concept. A real concept has a location in the procedure. It says where the music can be touched.

Evidence context:

- StemFX extraction: `j972b99xapwke0nsrs9mydqez58b2v83`
- TTSYoruba extraction: recent candidate from `sourceId` `jx70dp7xbjqv3d4gdjx5gjyrnd8b037b`
- Hindi depth-pruning TTS extraction: `j9700sw1kkjkwtyhp6427r5n0x8b1erd`
- Schrodinger Bridge Mamba extraction: `j97d337kfk4agn4a6h0vqktdcn8b3b4e`
