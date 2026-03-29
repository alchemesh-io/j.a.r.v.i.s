import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const frameworkOptions = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
];

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: 'Framework',
    options: frameworkOptions,
    placeholder: 'Choose a framework...',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Framework',
    options: frameworkOptions,
    defaultValue: 'react',
  },
};

export const WithError: Story = {
  args: {
    label: 'Framework',
    options: frameworkOptions,
    placeholder: 'Choose a framework...',
    error: 'Please select a framework',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Framework',
    options: frameworkOptions,
    defaultValue: 'vue',
    disabled: true,
  },
};
