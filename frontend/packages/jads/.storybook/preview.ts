import type { Preview } from '@storybook/react';
import '../src/theme.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'jarvis-dark',
      values: [
        { name: 'jarvis-dark', value: '#0a0e1a' },
        { name: 'jarvis-surface', value: '#111827' },
      ],
    },
  },
};

export default preview;
