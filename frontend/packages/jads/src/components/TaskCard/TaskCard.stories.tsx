import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TaskCard } from './TaskCard';

const meta: Meta<typeof TaskCard> = {
  title: 'Components/TaskCard',
  component: TaskCard,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['refinement', 'implementation', 'review'],
    },
    status: {
      control: 'select',
      options: ['created', 'done'],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

export const Refinement: Story = {
  args: {
    title: 'Refine daily planning feature requirements',
    type: 'refinement',
    status: 'created',
    sourceType: 'jira', sourceId: 'JAR-01',
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const Implementation: Story = {
  args: {
    title: 'Implement Calendar component',
    type: 'implementation',
    status: 'created',
    sourceType: 'jira', sourceId: 'JAR-12',
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const Review: Story = {
  args: {
    title: 'Review pull request #42',
    type: 'review',
    status: 'created',
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const Done: Story = {
  args: {
    title: 'Set up component library',
    type: 'implementation',
    status: 'done',
    sourceType: 'jira', sourceId: 'JAR-05',
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const WithoutActions: Story = {
  args: {
    title: 'Read-only task card',
    type: 'refinement',
    status: 'created',
    sourceType: 'jira', sourceId: 'JAR-99',
  },
};

export const AllTypes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--jads-space-3)' }}>
      <TaskCard title="Refine search feature" type="refinement" status="created" sourceType="jira" sourceId="JAR-01" onEdit={() => {}} onDelete={() => {}} />
      <TaskCard title="Build task board" type="implementation" status="created" sourceType="jira" sourceId="JAR-02" onEdit={() => {}} onDelete={() => {}} />
      <TaskCard title="Review auth flow" type="review" status="created" sourceType="jira" sourceId="JAR-03" onEdit={() => {}} onDelete={() => {}} />
      <TaskCard title="Completed task" type="implementation" status="done" sourceType="jira" sourceId="JAR-04" onEdit={() => {}} onDelete={() => {}} />
    </div>
  ),
};
