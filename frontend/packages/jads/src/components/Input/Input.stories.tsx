import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
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
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Full Name',
    placeholder: 'Enter your name',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Email',
    type: 'email',
    defaultValue: 'user@jarvis.dev',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    type: 'email',
    defaultValue: 'invalid-email',
    error: 'Please enter a valid email address',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Read Only',
    defaultValue: 'Cannot edit this',
    disabled: true,
  },
};

export const Password: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
  },
};
