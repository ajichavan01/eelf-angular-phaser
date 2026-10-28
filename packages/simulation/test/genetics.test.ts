import assert from 'node:assert/strict';
import test from 'node:test';
import { CHROMOSOMES, createGenome, featurePresent, GENE_DEFINITIONS, gene, inheritGenome } from '../src/Genetics/Genome.ts';
import { Random } from '../src/Utilities.ts';

test('a seed produces identical chromosomes and resumable random state', () => {
  const original = new Random(42);
  assert.deepEqual(createGenome(original), createGenome(new Random(42)));
  const resumed = new Random(original.state);
  assert.equal(original.next(), resumed.next());
});

test('presence genes use the original inclusive 0.5 threshold', () => {
  const genome = createGenome(new Random(42));
  const position = GENE_DEFINITIONS.Vision.indexOf('eyesPresent');
  genome.Vision[position] = 0.49;
  assert.equal(featurePresent(genome, 'eyesPresent'), false);
  genome.Vision[position] = 0.5;
  assert.equal(featurePresent(genome, 'eyesPresent'), true);
});

test('crossover keeps alleles in bounds and never mutates either parent', () => {
  const random = new Random(12);
  const parent = createGenome(random);
  const partner = createGenome(random);
  const before = structuredClone([parent, partner]);
  for (let iteration = 0; iteration < 100; iteration++) {
    const child = inheritGenome(parent, partner, random, 1);
    for (const chromosome of CHROMOSOMES) {
      assert.equal(child[chromosome].length, GENE_DEFINITIONS[chromosome].length);
      assert.ok(child[chromosome].every(allele => allele >= 0 && allele <= 1));
    }
  }
  assert.deepEqual([parent, partner], before);
  assert.ok(gene(parent, 'speed') >= 0);
});