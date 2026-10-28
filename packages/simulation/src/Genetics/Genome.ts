import { clamp, Random } from '../Utilities.ts';

export const CHROMOSOMES = ['Body', 'Vision', 'Physics', 'Mouth', 'Aging', 'Metabolism', 'Reproduction', 'Olfactory'] as const;
export type ChromosomeID = typeof CHROMOSOMES[number];

export const GENE_DEFINITIONS = {
  Body: ['bodyLength', 'bodyHeight', 'bodyWidth', 'bodyTaper', 'bodySpacing', 'skinToughness', 'flippersPresent', 'flipperSize', 'tailPresent', 'tailSize', 'bodyHue'],
  Vision: ['eyesPresent', 'eyeSize', 'visionAngle', 'visionDistance', 'visionDominance'],
  Physics: ['speed', 'turnRate', 'mass'],
  Mouth: ['mouthPresent', 'mouthSize', 'biteStrength'],
  Aging: ['lifeSpan', 'matureAge'],
  Metabolism: ['stomachSize', 'digestionRate', 'plantEfficiency', 'meatEfficiency', 'maxEnergy', 'maxHealth', 'healing'],
  Reproduction: ['birthCost', 'birthRecovery', 'mutationRate'],
  Olfactory: ['scentDistance', 'scentDominance'],
} as const satisfies Record<ChromosomeID, readonly string[]>;

export type GeneID = typeof GENE_DEFINITIONS[ChromosomeID][number];
export type Genome = Record<ChromosomeID, number[]>;

const geneLocations = new Map<GeneID, [ChromosomeID, number]>(
  CHROMOSOMES.flatMap(chromosome => GENE_DEFINITIONS[chromosome].map((gene, index) => [gene, [chromosome, index]] as [GeneID, [ChromosomeID, number]])),
);

export function gene(genome: Genome, identifier: GeneID): number {
  const [chromosome, index] = geneLocations.get(identifier)!;
  return genome[chromosome][index];
}

export function createGenome(random: Random): Genome {
  return Object.fromEntries(CHROMOSOMES.map(chromosome => [
    chromosome,
    GENE_DEFINITIONS[chromosome].map(identifier => {
      const value = random.next();
      return identifier === 'mouthPresent' ? 0.55 + value * 0.45 : value;
    }),
  ])) as Genome;
}

export function inheritGenome(parent: Genome, partner: Genome, random: Random, mutationRate: number): Genome {
  return Object.fromEntries(CHROMOSOMES.map(chromosome => [
    chromosome,
    parent[chromosome].map((allele, index) => {
      const inherited = random.next() < 0.5 ? allele : partner[chromosome][index];
      return random.next() < mutationRate ? clamp(inherited + random.between(-0.16, 0.16), 0, 1) : inherited;
    }),
  ])) as Genome;
}

export function featurePresent(genome: Genome, feature: 'eyesPresent' | 'mouthPresent' | 'tailPresent' | 'flippersPresent'): boolean {
  return gene(genome, feature) >= 0.5;
}