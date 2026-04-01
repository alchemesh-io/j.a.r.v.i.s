import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: 'This is a card with some content inside it.',
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Dashboard Overview',
    children: 'Card content with a title header displayed above.',
  },
};

export const WithRichContent: Story = {
  render: () => (
    <Card title="Task Summary">
      <p style={{ color: 'var(--jads-color-text-muted)', marginBottom: 'var(--jads-space-4)' }}>
        3 tasks remaining for today
      </p>
      <p style={{ color: 'var(--jads-color-text)' }}>
        Next: Review pull request #42
      </p>
    </Card>
  ),
};
