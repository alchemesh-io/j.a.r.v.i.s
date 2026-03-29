import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from './IconButton';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 4H13M6 4V3H10V4M5 4V13H11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['ghost', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {
  args: {
    'aria-label': 'Close',
    variant: 'ghost',
    children: <CloseIcon />,
  },
};

export const Outline: Story = {
  args: {
    'aria-label': 'Edit',
    variant: 'outline',
    children: <EditIcon />,
  },
};

export const Small: Story = {
  args: {
    'aria-label': 'Delete',
    size: 'sm',
    children: <DeleteIcon />,
  },
};

export const Disabled: Story = {
  args: {
    'aria-label': 'Close',
    disabled: true,
    children: <CloseIcon />,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--jads-space-4)', alignItems: 'center' }}>
      <IconButton aria-label="Close" variant="ghost"><CloseIcon /></IconButton>
      <IconButton aria-label="Edit" variant="outline"><EditIcon /></IconButton>
      <IconButton aria-label="Delete" variant="ghost" size="sm"><DeleteIcon /></IconButton>
    </div>
  ),
};
