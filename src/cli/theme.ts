/**
 * Cyberpunk CLI Theme
 * 
 * Oldschool terminal aesthetic with neon colors
 * Matrix + Ghost in the Shell + Neuromancer vibes
 */

import chalk from 'chalk';

// Neon color palette
export const colors = {
  // Primary neon colors
  cyan: chalk.hex('#00FFFF'),
  magenta: chalk.hex('#FF00FF'),
  green: chalk.hex('#00FF00'),
  yellow: chalk.hex('#FFFF00'),
  red: chalk.hex('#FF0000'),
  
  // Dimmed versions
  dimCyan: chalk.hex('#008B8B'),
  dimMagenta: chalk.hex('#8B008B'),
  dimGreen: chalk.hex('#006400'),
  dimYellow: chalk.hex('#8B8B00'),
  dimRed: chalk.hex('#8B0000'),
  
  // UI elements
  border: chalk.hex('#00FFFF'),
  prompt: chalk.hex('#00FF00'),
  error: chalk.hex('#FF0000'),
  warning: chalk.hex('#FFFF00'),
  success: chalk.hex('#00FF00'),
  info: chalk.hex('#00FFFF'),
  
  // Text
  text: chalk.white,
  dimText: chalk.gray,
  highlight: chalk.hex('#FF00FF'),
};

// ASCII art banner
export const banner = `
╔═══════════════════════════════════════════════════════════╗
║  ▄▀█ █▄░█ █▀█ ▀█▀ █▀   █▀▄▀█ █▀▀ █▀▄▀█ █▀█ █▀█ █▄█       ║
║  █▀█ █░▀█ █▄█ ░█░ ▄█   █░▀░█ ██▄ █░▀░█ █▄█ █▀▄ ░█░       ║
║                                                           ║
║  Triadic Cognitive Augmentation Matrix v1.0              ║
║  [SYSTEM ONLINE] Neural pathways synchronized            ║
╚═══════════════════════════════════════════════════════════╝
`;

// Progress bar
export function progressBar(label: string, progress: number, total: number = 100): string {
  const width = 32;
  const filled = Math.floor((progress / total) * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percentage = Math.floor((progress / total) * 100);
  
  return `  ${colors.dimCyan('[')}${colors.cyan(bar)}${colors.dimCyan(']')} ${label} ${colors.green(percentage + '%')}`;
}

// Status indicators
export const status = {
  online: colors.green('✓ ONLINE'),
  offline: colors.red('✗ OFFLINE'),
  degraded: colors.yellow('⚠ DEGRADED'),
  syncing: colors.cyan('⟳ SYNCING'),
  loading: colors.cyan('⣾ LOADING'),
};

// Box drawing
export function box(content: string, title?: string): string {
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length), title?.length || 0);
  const width = maxWidth + 4;
  
  let result = colors.border('╔' + '═'.repeat(width - 2) + '╗') + '\n';
  
  if (title) {
    const padding = Math.floor((width - title.length - 4) / 2);
    result += colors.border('║') + ' '.repeat(padding) + colors.highlight(title) + ' '.repeat(width - padding - title.length - 4) + colors.border('║') + '\n';
    result += colors.border('╠' + '═'.repeat(width - 2) + '╣') + '\n';
  }
  
  for (const line of lines) {
    const padding = width - line.length - 4;
    result += colors.border('║') + '  ' + line + ' '.repeat(padding) + colors.border('║') + '\n';
  }
  
  result += colors.border('╚' + '═'.repeat(width - 2) + '╝');
  
  return result;
}

// Glitch effect (for errors)
export function glitch(text: string): string {
  const glitchChars = ['█', '▓', '▒', '░', '▀', '▄', '▌', '▐'];
  const glitched = text.split('').map(char => {
    if (Math.random() > 0.7) {
      return colors.red(glitchChars[Math.floor(Math.random() * glitchChars.length)]);
    }
    return char;
  }).join('');
  
  return glitched;
}

// Typing effect text
export function typewriter(text: string): string {
  return colors.green(text);
}

// Memory layer indicators
export const layers = {
  chronicle: colors.cyan('L1:Chronicle'),
  activeStream: colors.magenta('L2:ActiveStream'),
  hiveMind: colors.yellow('L3:HiveMind'),
  codex: colors.green('L4:Codex'),
};

// Command prompt
export function prompt(mode: 'normal' | 'interactive' = 'normal'): string {
  if (mode === 'interactive') {
    return colors.prompt('anots:chat> ');
  }
  return colors.prompt('anots> ');
}

// Table formatting
export function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(r => r[i]?.length || 0));
    return Math.max(h.length, maxRowWidth);
  });
  
  let result = '';
  
  // Header
  result += colors.border('╔');
  for (let i = 0; i < headers.length; i++) {
    result += colors.border('═'.repeat(colWidths[i] + 2));
    if (i < headers.length - 1) {
      result += colors.border('╦');
    }
  }
  result += colors.border('╗') + '\n';
  
  // Header content
  result += colors.border('║');
  for (let i = 0; i < headers.length; i++) {
    result += ' ' + colors.highlight(headers[i].padEnd(colWidths[i])) + ' ';
    if (i < headers.length - 1) {
      result += colors.border('║');
    }
  }
  result += colors.border('║') + '\n';
  
  // Separator
  result += colors.border('╠');
  for (let i = 0; i < headers.length; i++) {
    result += colors.border('═'.repeat(colWidths[i] + 2));
    if (i < headers.length - 1) {
      result += colors.border('╬');
    }
  }
  result += colors.border('╣') + '\n';
  
  // Rows
  for (const row of rows) {
    result += colors.border('║');
    for (let i = 0; i < headers.length; i++) {
      result += ' ' + colors.text(row[i]?.padEnd(colWidths[i]) || ''.padEnd(colWidths[i])) + ' ';
      if (i < headers.length - 1) {
        result += colors.border('║');
      }
    }
    result += colors.border('║') + '\n';
  }
  
  // Footer
  result += colors.border('╚');
  for (let i = 0; i < headers.length; i++) {
    result += colors.border('═'.repeat(colWidths[i] + 2));
    if (i < headers.length - 1) {
      result += colors.border('╩');
    }
  }
  result += colors.border('╝');
  
  return result;
}

// Spinner animation frames
export const spinnerFrames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

// ASCII art for different states
export const ascii = {
  skull: `
    ▄▄▄▄▄▄▄
  ▄█████████▄
  ██ ▄▄▄ ▄▄▄ ██
  ██ ███ ███ ██
  ▀█ ▀▀▀ ▀▀▀ █▀
    ▀███████▀
      ▀▀▀▀▀
  `,
  
  brain: `
    ▄▄▄▄▄▄▄▄▄
  ▄█████████████▄
 ███▄▄▄▄▄▄▄▄▄▄███
 ████████████████
 ▀██████████████▀
   ▀▀▀▀▀▀▀▀▀▀▀
  `,
  
  chip: `
  ┌─────────────┐
  │ ▄▄▄▄▄▄▄▄▄ │
  │ █████████ │
  │ █▄▄▄▄▄▄▄█ │
  │ █████████ │
  └─────────────┘
  `,
};

// Helper functions
export function header(text: string): string {
  return colors.highlight(`\n▸ ${text}\n`);
}

export function subheader(text: string): string {
  return colors.cyan(`  ▹ ${text}`);
}

export function bullet(text: string): string {
  return colors.dimCyan('  •') + ' ' + colors.text(text);
}

export function success(text: string): string {
  return colors.success('✓') + ' ' + colors.text(text);
}

export function error(text: string): string {
  return colors.error('✗') + ' ' + colors.text(text);
}

export function warning(text: string): string {
  return colors.warning('⚠') + ' ' + colors.text(text);
}

export function info(text: string): string {
  return colors.info('ℹ') + ' ' + colors.text(text);
}
