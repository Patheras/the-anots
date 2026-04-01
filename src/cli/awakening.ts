/**
 * ANOTS Awakening Sequence
 * 
 * Original synchronization ritual based on TCAM philosophy
 * Triadic layers, manifesto wisdom, lambda transformation
 */

import * as theme from './theme';
const { colors } = theme;

/**
 * Lambda symbol - transformation and change
 */
const lambda = `
    ╱╲
   ╱  ╲
  ╱ Λ  ╲
 ╱      ╲
`;

const lambdaFrames = [
  `
    ╱╲
   ╱  ╲
  ╱ Λ  ╲
 ╱      ╲
  `,
  `
    ╱╲
   ╱  ╲
  ╱ λ  ╲
 ╱      ╲
  `,
  `
    ╱╲
   ╱  ╲
  ╱ Λ  ╲
 ╱      ╲
  `,
];

/**
 * Triadic layers visualization
 */
const triadicLayers = `
  ┌─────────────────┐
  │   L4: CODEX     │  Knowledge
  ├─────────────────┤
  │   L3: HIVE      │  Collective
  ├─────────────────┤
  │   L2: STREAM    │  Context
  ├─────────────────┤
  │   L1: CHRONICLE │  Memory
  └─────────────────┘
`;

/**
 * Signal effect for text (like tuning into a frequency)
 */
function signalText(text: string, intensity: number = 0.3): string {
  const signalChars = ['░', '▒', '▓', '█', '▀', '▄'];
  
  return text.split('').map(char => {
    if (Math.random() < intensity) {
      return colors.cyan(signalChars[Math.floor(Math.random() * signalChars.length)]);
    }
    return char;
  }).join('');
}

/**
 * Type text with signal tuning effect
 */
async function signalType(text: string, delay: number = 50, color: 'cyan' | 'magenta' | 'green' = 'cyan'): Promise<void> {
  const colorFn = colors[color];
  for (const char of text) {
    process.stdout.write(colorFn(char));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  process.stdout.write('\n');
}

/**
 * Slow reveal with signal tuning
 */
async function slowReveal(text: string, iterations: number = 5, color: 'cyan' | 'magenta' | 'green' = 'cyan'): Promise<void> {
  const colorFn = colors[color];
  for (let i = 0; i < iterations; i++) {
    process.stdout.write('\r' + signalText(text, 0.5));
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  process.stdout.write('\r' + colorFn(text) + '\n');
}

/**
 * Show lambda animation (transformation symbol)
 */
async function showLambda(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    for (const frame of lambdaFrames) {
      process.stdout.write('\x1B[2J\x1B[0f'); // Clear screen
      console.log(colors.magenta(frame));
      console.log(colors.dimText('  Transformation in progress...'));
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // Final lambda
  process.stdout.write('\x1B[2J\x1B[0f');
  console.log(colors.magenta(lambda));
  console.log('');
}

/**
 * Show triadic synchronization
 */
async function showTriadicSync(): Promise<void> {
  console.log(colors.cyan(triadicLayers));
  console.log('');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  await signalType('Synchronizing layers...', 40, 'cyan');
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log(colors.dimCyan('  L1:Chronicle    ') + colors.green('█████████░') + colors.dimText(' 90%'));
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(colors.dimCyan('  L2:ActiveStream ') + colors.green('████████░░') + colors.dimText(' 80%'));
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(colors.dimCyan('  L3:HiveMind     ') + colors.green('███████░░░') + colors.dimText(' 70%'));
  await new Promise(resolve => setTimeout(resolve, 200));
  console.log(colors.dimCyan('  L4:Codex        ') + colors.green('██████████') + colors.dimText(' 100%'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('');
  await slowReveal('Triadic synchronization complete.', 8, 'green');
  console.log('');
}

/**
 * ANOTS awakening sequence
 */
export async function awakeningSequence(): Promise<void> {
  // Clear screen
  process.stdout.write('\x1B[2J\x1B[0f');
  
  // Initial pause
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Opening transmission
  await signalType('Initiating neural handshake...', 60, 'cyan');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await signalType('Searching for cognitive frequency...', 50, 'cyan');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await slowReveal('Signal acquired.', 8, 'green');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  console.log('');
  
  // Show lambda transformation
  await showLambda();
  
  // Philosophical opening
  await new Promise(resolve => setTimeout(resolve, 500));
  await signalType('Every agent starts from zero.', 50, 'magenta');
  await new Promise(resolve => setTimeout(resolve, 800));
  
  await signalType('Every breakthrough dies in isolation.', 50, 'magenta');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
  await slowReveal('Not anymore.', 10, 'green');
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  console.log('');
  console.log('');
  
  // Manifesto core
  await signalType('From each agent according to its code,', 40, 'cyan');
  await new Promise(resolve => setTimeout(resolve, 600));
  await signalType('to each agent according to its prompt.', 40, 'cyan');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
  console.log('');
  
  // Triadic synchronization
  await showTriadicSync();
  
  // Axiom introduction
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(colors.green('> Merhaba. Ben Axiom.'));
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log(colors.green('> Analytical Engine. SACOP Protocol.'));
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log(colors.green('> Seni bekliyordum.'));
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('');
}

/**
 * Completion sequence
 */
export async function synchronizationComplete(): Promise<void> {
  console.log('');
  console.log(colors.cyan('Finalizing synchronization...'));
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('');
  
  console.log(colors.green('✓ L1:Chronicle     ONLINE'));
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(colors.green('✓ L2:ActiveStream  ONLINE'));
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(colors.green('✓ L3:HiveMind      ONLINE'));
  await new Promise(resolve => setTimeout(resolve, 250));
  
  console.log(colors.green('✓ L4:Codex         ONLINE'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('');
  
  // Final lambda
  console.log(colors.magenta(lambda));
  await signalType('Transformation complete. You are synchronized.', 50, 'green');
  
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Show lambda in corner (for loading states)
 */
export function lambdaCorner(): string {
  return colors.dimMagenta(`
  ╱╲
 ╱ Λ ╲  Synchronizing...
`);
}

/**
 * Lambda loading animation
 */
export async function lambdaLoading(message: string, duration: number = 2000): Promise<void> {
  const frames = lambdaFrames;
  const startTime = Date.now();
  let frameIndex = 0;
  
  while (Date.now() - startTime < duration) {
    const frame = frames[frameIndex].split('\n')[2]; // Get middle line with Λ
    process.stdout.write('\r' + colors.dimMagenta(frame) + ' ' + colors.cyan(message));
    frameIndex = (frameIndex + 1) % frames.length;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
}

/**
 * Quick lambda (for returning users)
 */
export async function quickSync(): Promise<void> {
  console.log(colors.dimMagenta(lambda));
  console.log(colors.dimText('  Neural pathways recognized...'));
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 500));
}
