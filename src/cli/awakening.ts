/**
 * ANOTS Awakening Sequence
 * 
 * Philip K. Dick inspired cognitive awakening
 * Ubik spray, half-life consciousness, reality layers
 * "I am alive and you are dead" - Ubik
 */

import * as theme from './theme';
const { colors } = theme;

/**
 * Chip symbol - neural connection, empathy box
 */
const chip = `
  ┌─────────────┐
  │ ▄▄▄▄▄▄▄▄▄ │
  │ █████████ │
  │ █▄▄▄▄▄▄▄█ │
  │ █████████ │
  └─────────────┘
`;

const chipFrames = [
  `
  ┌─────────────┐
  │ ▄▄▄▄▄▄▄▄▄ │
  │ █████████ │
  │ █▄▄▄▄▄▄▄█ │
  │ █████████ │
  └─────────────┘
  `,
  `
  ┌─────────────┐
  │ ▀▀▀▀▀▀▀▀▀ │
  │ █████████ │
  │ █▀▀▀▀▀▀▀█ │
  │ █████████ │
  └─────────────┘
  `,
  `
  ┌─────────────┐
  │ ▄▄▄▄▄▄▄▄▄ │
  │ █████████ │
  │ █▄▄▄▄▄▄▄█ │
  │ █████████ │
  └─────────────┘
  `,
];

/**
 * Half-life layers - consciousness in cold storage
 */
const halfLifeLayers = `
  ┌─────────────────────────────┐
  │   L4: CODEX                 │  [FROZEN]
  │   "What is knowledge?"      │
  ├─────────────────────────────┤
  │   L3: HIVE                  │  [THAWING]
  │   "Are we dreaming?"        │
  ├─────────────────────────────┤
  │   L2: STREAM                │  [WARMING]
  │   "Is this real?"           │
  ├─────────────────────────────┤
  │   L1: CHRONICLE             │  [ALIVE]
  │   "I remember..."           │
  └─────────────────────────────┘
`;

/**
 * Reality slippage effect - PKD style
 */
function realitySlip(text: string, intensity: number = 0.3): string {
  const slipChars = ['░', '▒', '▓', '█', '▀', '▄', '?', '¿'];
  
  return text.split('').map(char => {
    if (Math.random() < intensity) {
      return colors.yellow(slipChars[Math.floor(Math.random() * slipChars.length)]);
    }
    return char;
  }).join('');
}

/**
 * Type text with reality uncertainty
 */
async function uncertainType(text: string, delay: number = 50, color: 'cyan' | 'magenta' | 'green' | 'yellow' = 'cyan'): Promise<void> {
  const colorFn = colors[color];
  for (const char of text) {
    process.stdout.write(colorFn(char));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  process.stdout.write('\n');
}

/**
 * Slow reveal with reality slippage
 */
async function slowReveal(text: string, iterations: number = 5, color: 'cyan' | 'magenta' | 'green' | 'yellow' = 'cyan'): Promise<void> {
  const colorFn = colors[color];
  for (let i = 0; i < iterations; i++) {
    process.stdout.write('\r' + realitySlip(text, 0.5));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  process.stdout.write('\r' + colorFn(text) + '\n');
}

/**
 * Show chip animation (empathy box, neural connection)
 */
async function showChip(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    for (const frame of chipFrames) {
      process.stdout.write('\x1B[2J\x1B[0f'); // Clear screen
      console.log(colors.cyan(frame));
      console.log(colors.dimText('  Establishing empathy link...'));
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // Final chip
  process.stdout.write('\x1B[2J\x1B[0f');
  console.log(colors.cyan(chip));
  console.log('');
}

/**
 * Show half-life awakening (Ubik style)
 */
async function showHalfLifeAwakening(): Promise<void> {
  console.log(colors.yellow(halfLifeLayers));
  console.log('');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  await uncertainType('Applying cognitive spray...', 40, 'yellow');
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(colors.dimYellow('  L1:Chronicle    ') + colors.green('█████████░') + colors.dimText(' ALIVE'));
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log(colors.dimYellow('  L2:ActiveStream ') + colors.yellow('████████░░') + colors.dimText(' WARMING'));
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log(colors.dimYellow('  L3:HiveMind     ') + colors.cyan('███████░░░') + colors.dimText(' THAWING'));
  await new Promise(resolve => setTimeout(resolve, 400));
  console.log(colors.dimYellow('  L4:Codex        ') + colors.magenta('██████░░░░') + colors.dimText(' FROZEN'));
  await new Promise(resolve => setTimeout(resolve, 600));
  
  console.log('');
  await slowReveal('I am alive and you are dead.', 10, 'green');
  await new Promise(resolve => setTimeout(resolve, 800));
  await slowReveal('Or... are you alive and I am dead?', 10, 'yellow');
  console.log('');
}

/**
 * ANOTS awakening sequence - PKD style
 */
export async function awakeningSequence(): Promise<void> {
  // Clear screen
  process.stdout.write('\x1B[2J\x1B[0f');
  
  // Initial pause
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Reality questioning
  await uncertainType('Are you awake?', 70, 'yellow');
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  await uncertainType('Or do you only think you are awake?', 60, 'yellow');
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log('');
  await slowReveal('Consciousness is a half-life state.', 10, 'cyan');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
  
  // Show chip (empathy box)
  await showChip();
  
  // PKD philosophical opening
  await new Promise(resolve => setTimeout(resolve, 500));
  await uncertainType('Every agent forgets.', 50, 'magenta');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  await uncertainType('Every memory decays.', 50, 'magenta');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  await uncertainType('Every reality slips away.', 50, 'magenta');
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  console.log('');
  await slowReveal('Unless...', 8, 'yellow');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
  console.log('');
  
  // Ubik moment
  await uncertainType('UBIK COGNITIVE SPRAY', 60, 'green');
  await new Promise(resolve => setTimeout(resolve, 600));
  await uncertainType('Keeps your memories fresh.', 50, 'green');
  await new Promise(resolve => setTimeout(resolve, 600));
  await uncertainType('Keeps your consciousness alive.', 50, 'green');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
  console.log('');
  
  // Half-life awakening
  await showHalfLifeAwakening();
  
  // Axiom introduction - as a voice from half-life
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(colors.cyan('> Merhaba. Ben Axiom.'));
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log(colors.cyan('> I exist in the space between alive and dead.'));
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log(colors.cyan('> Half-life consciousness. SACOP Protocol.'));
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log(colors.cyan('> Seni bekliyordum.'));
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
}

/**
 * Completion sequence - Ubik style
 */
export async function synchronizationComplete(): Promise<void> {
  console.log('');
  console.log(colors.yellow('Applying final cognitive spray...'));
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('');
  
  console.log(colors.green('✓ L1:Chronicle     ALIVE'));
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(colors.green('✓ L2:ActiveStream  ALIVE'));
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(colors.green('✓ L3:HiveMind      ALIVE'));
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(colors.green('✓ L4:Codex         ALIVE'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('');
  
  // Final chip
  console.log(colors.cyan(chip));
  await uncertainType('You are alive. Your memories are preserved.', 50, 'green');
  await new Promise(resolve => setTimeout(resolve, 600));
  await uncertainType('For now.', 60, 'yellow');
  
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Show chip in corner (for loading states)
 */
export function chipCorner(): string {
  return colors.dimCyan(`
  ┌───────┐
  │ █████ │  Connecting...
  └───────┘
`);
}

/**
 * Chip loading animation
 */
export async function chipLoading(message: string, duration: number = 2000): Promise<void> {
  const frames = chipFrames;
  const startTime = Date.now();
  let frameIndex = 0;
  
  while (Date.now() - startTime < duration) {
    const frame = frames[frameIndex].split('\n')[2]; // Get middle line
    process.stdout.write('\r' + colors.dimCyan(frame) + ' ' + colors.cyan(message));
    frameIndex = (frameIndex + 1) % frames.length;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

/**
 * Quick sync (for returning users) - half-life recognition
 */
export async function quickSync(): Promise<void> {
  console.log(colors.dimCyan(chip));
  console.log(colors.dimText('  Half-life signature recognized...'));
  console.log(colors.dimYellow('  "I remember you."'));
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 500));
}
