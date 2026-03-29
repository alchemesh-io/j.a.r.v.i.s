import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Calendar } from './Calendar';

const meta: Meta<typeof Calendar> = {
  title: 'Components/Calendar',
  component: Calendar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Calendar>;

export const Default: Story = {
  args: {
    selectedDate: new Date(),
    onDateSelect: () => {},
  },
};

export const Interactive: Story = {
  render: () => {
    const [date, setDate] = useState(new Date());
    return (
      <div>
        <Calendar selectedDate={date} onDateSelect={setDate} />
        <p style={{
          color: 'var(--jads-color-text-muted)',
          fontSize: 'var(--jads-font-size-sm)',
          marginTop: 'var(--jads-space-4)',
        }}>
          Selected: {date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
    );
  },
};

export const SpecificDate: Story = {
  args: {
    selectedDate: new Date(2026, 2, 29),
    onDateSelect: () => {},
  },
};
