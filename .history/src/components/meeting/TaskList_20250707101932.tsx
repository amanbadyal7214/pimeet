import React, { useState } from 'react';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

const initialTasks: Task[] = [
  { id: 1, text: 'Meeting scheduled for next Friday', completed: true },
  { id: 2, text: 'Prepare Style Guide', completed: false },
  { id: 3, text: 'Share Design feedback to Kate', completed: false },
  { id: 4, text: 'Call Adams for discussion', completed: false },
  { id: 5, text: 'Interview scheduled for Jr. Designers', completed: false },
];

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 text-white w-72">
      <h3 className="font-semibold mb-3">Daily Task</h3>
      <ul className="space-y-2">
        {tasks.map(task => (
          <li key={task.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-sm ${task.completed ? 'line-through text-gray-400' : ''}`}>
              {task.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;
