import type { Meta, StoryObj } from '@storybook/react';
import { WorkerModeBadge } from './WorkerModeBadge';

const meta: Meta<typeof WorkerModeBadge> = {
  title: 'Components/WorkerModeBadge',
  component: WorkerModeBadge,
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: 'select',
      options: ['ephemeral', 'stateful'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof WorkerModeBadge>;

export const Ephemeral: Story = {
  args: { mode: 'ephemeral' },
};

export const Stateful: Story = {
  args: { mode: 'stateful' },
};

export const SideBySide: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <WorkerModeBadge mode="ephemeral" />
      <WorkerModeBadge mode="stateful" />
    </div>
  ),
};
