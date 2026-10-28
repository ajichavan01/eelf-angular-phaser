import assert from 'node:assert/strict';
import test from 'node:test';
import { SnapshotInterpolator, hueColor, segmentPose } from '../../browser/src/Drawing.ts';
import { World } from '../src/index.ts';

test('render interpolation blends poses without changing authoritative snapshots', () => {
  const motion = new SnapshotInterpolator();
  const world = new World();
  const first = world.frame();
  first.creatures[0].angle = Math.PI - 0.1;
  motion.accept(first, 0);
  const next = structuredClone(first);
  next.statistics.tick += 3;
  next.statistics.time += 0.1;
  next.creatures[0].x += 10;
  next.creatures[0].angle = -Math.PI + 0.1;
  motion.accept(next, 100);
  const pose = motion.sample(next.creatures[0], 150);
  assert.equal(pose.x, first.creatures[0].x + 5);
  assert.ok(Math.abs(pose.angle - Math.PI) < 1e-9);
  assert.equal(next.creatures[0].x, first.creatures[0].x + 10);
  assert.equal(motion.time(150), 0.05);
});

test('restarts and paused same-tick frames snap immediately', () => {
  const motion = new SnapshotInterpolator();
  const world = new World();
  motion.accept(world.frame(), 0);
  world.step(3);
  const frame = world.frame();
  motion.accept(frame, 100);
  motion.accept(frame, 120);
  assert.deepEqual(motion.sample(frame.creatures[0], 120), frame.creatures[0]);
  const reset = new World().frame();
  motion.accept(reset, 150);
  assert.deepEqual(motion.sample(reset.creatures[0], 150), reset.creatures[0]);
});

test('procedural body geometry is finite and hues stay in RGB bounds', () => {
  const world = new World();
  for (const creature of world.population.creatures) {
    assert.ok(hueColor(creature.traits.hue) >= 0 && hueColor(creature.traits.hue) <= 0xffffff);
    for (let index = 0; index < creature.traits.segments; index++) {
      const pose = segmentPose(creature.traits, index, 100, creature.id);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.radiusX > 0 && pose.radiusY > 0);
    }
  }
});