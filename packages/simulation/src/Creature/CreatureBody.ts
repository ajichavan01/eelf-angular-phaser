import { featurePresent, gene } from '../Genetics/Genome.ts';
import type { Genome } from '../Genetics/Genome.ts';

export interface Phenotype {
  segments: number;
  radius: number;
  width: number;
  taper: number;
  spacing: number;
  hue: number;
  flippers: number;
  tail: number;
  eyes: number;
  mouth: number;
  speed: number;
  turnRate: number;
  mass: number;
  visionRange: number;
  visionAngle: number;
  visionDominance: number;
  scentRange: number;
  scentDominance: number;
  bite: number;
  lifespan: number;
  maturity: number;
  stomachCapacity: number;
  digestion: number;
  plantEfficiency: number;
  meatEfficiency: number;
  maxEnergy: number;
  maxHealth: number;
  healing: number;
  birthCost: number;
  birthRecovery: number;
  mutation: number;
}

export function expressGenome(genome: Genome): Phenotype {
  const flippers = featurePresent(genome, 'flippersPresent') ? 0.35 + gene(genome, 'flipperSize') : 0;
  const tail = featurePresent(genome, 'tailPresent') ? 0.3 + gene(genome, 'tailSize') : 0;
  const eyes = featurePresent(genome, 'eyesPresent') ? 0.6 + gene(genome, 'eyeSize') * 0.8 : 0;
  const mouth = featurePresent(genome, 'mouthPresent') ? 0.4 + gene(genome, 'mouthSize') * 0.5 : 0;
  const radius = 5 + gene(genome, 'bodyHeight') * 6;
  const mass = 10 + gene(genome, 'mass') * 18 + gene(genome, 'bodyLength') * 12;
  return {
    segments: 3 + Math.round(gene(genome, 'bodyLength') * 5),
    radius,
    width: 0.65 + gene(genome, 'bodyWidth') * 0.65,
    taper: 0.08 + gene(genome, 'bodyTaper') * 0.1,
    spacing: 0.75 + gene(genome, 'bodySpacing') * 0.5,
    hue: gene(genome, 'bodyHue') * 360,
    flippers,
    tail,
    eyes,
    mouth,
    speed: (26 + gene(genome, 'speed') * 40 + tail * 12) / (1 + mass * 0.007),
    turnRate: 1.2 + gene(genome, 'turnRate') * 2 + flippers * 0.7,
    mass,
    visionRange: eyes ? 55 + gene(genome, 'visionDistance') * 170 : 0,
    visionAngle: eyes ? Math.PI * (0.2 + gene(genome, 'visionAngle') * 1.4) : 0,
    visionDominance: eyes ? gene(genome, 'visionDominance') : 0,
    scentRange: 25 + gene(genome, 'scentDistance') * 130,
    scentDominance: gene(genome, 'scentDominance'),
    bite: mouth ? 3 + gene(genome, 'biteStrength') * 7 : 0,
    lifespan: 180 + gene(genome, 'lifeSpan') * 540,
    maturity: 18 + gene(genome, 'matureAge') * 32,
    stomachCapacity: 8 + gene(genome, 'stomachSize') * 18,
    digestion: 0.35 + gene(genome, 'digestionRate') * 0.85,
    plantEfficiency: 0.35 + gene(genome, 'plantEfficiency') * 0.65,
    meatEfficiency: 0.35 + gene(genome, 'meatEfficiency') * 0.65,
    maxEnergy: 100 + gene(genome, 'maxEnergy') * 100,
    maxHealth: 50 + gene(genome, 'maxHealth') * 50 + gene(genome, 'skinToughness') * 20,
    healing: 0.15 + gene(genome, 'healing') * 0.6,
    birthCost: 0.2 + gene(genome, 'birthCost') * 0.12,
    birthRecovery: 20 + gene(genome, 'birthRecovery') * 40,
    mutation: 0.5 + gene(genome, 'mutationRate'),
  };
}